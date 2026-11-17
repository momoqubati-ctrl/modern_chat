import { getDb, notext } from "@newchat/db";
import { sanitizeHtmlText, toEnglishDigits } from "@newchat/shared";

export interface FilterRule {
  id: number;
  type?: string | null;
  path?: string | null;
  v: string | null;
}

export interface FilterResult {
  allowed: boolean;
  reason?: string;
  matchedWord?: string;
  rule?: FilterRule;
  actionPath?: string;
}

const SEPARATORS = "[\\s,;\"'|.!؟،\\-_/\\\\()<>\\[\\]{}]";

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class FilterService {
  private rules: FilterRule[] = [];
  private ruleMap = new Map<string, FilterRule>();
  private allowedWords = new Set<string>();
  private combinedRegex: RegExp | null = null;

  private isReady = false;
  private isRefreshing = false;
  private lastLoadedAt = 0;
  private readonly ttlMs: number;

  constructor(ttlMs = 60_000) {
    this.ttlMs = Math.max(5_000, ttlMs);
  }

  isInitialized(): boolean {
    return this.isReady;
  }

  /**
   * Warm the filter cache during server boot so even the very first message
   * does not wait on the database.
   */
  async warmFilterCache(): Promise<void> {
    await this.fetchAndCompile();
  }

  /**
   * Background revalidation (stale-while-revalidate).
   * Does not block the current message execution.
   */
  async revalidateInBackground(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    try {
      await this.fetchAndCompile();
    } catch (err) {
      console.warn("[FilterService] Background revalidation warning:", err);
    } finally {
      this.isRefreshing = false;
    }
  }

  private triggerBackgroundRevalidateIfStale(): void {
    if (this.isReady && !this.isRefreshing && Date.now() - this.lastLoadedAt > this.ttlMs) {
      void this.revalidateInBackground();
    }
  }

  private async fetchAndCompile(): Promise<void> {
    const { db } = getDb();
    const rows = await db.select().from(notext);

    const nextRules: FilterRule[] = rows.map((r) => ({
      id: r.id,
      type: r.type,
      path: r.path,
      v: r.v,
    }));

    const nextRuleMap = new Map<string, FilterRule>();
    const nextAllowed = new Set<string>();
    const activeWords: string[] = [];

    for (const r of nextRules) {
      const raw = String(r.v || "").trim();
      if (!raw) continue;
      const lower = raw.toLowerCase();

      if (r.path === "amsgs") {
        nextAllowed.add(lower);
      } else {
        nextRuleMap.set(lower, r);
        activeWords.push(raw);
      }
    }

    const filteredActive = activeWords.filter((w) => !nextAllowed.has(w.toLowerCase()));

    // Pre-compile single combined Regex
    let nextCombinedRegex: RegExp | null = null;
    if (filteredActive.length > 0) {
      // Sort by length descending so multi-word or longer terms match before substrings
      const sorted = [...filteredActive].sort((a, b) => b.length - a.length);
      const escaped = sorted.map((w) => escapeRegex(w));
      const pattern = `(?:^|${SEPARATORS})(${escaped.join("|")})(?:$|${SEPARATORS})`;
      nextCombinedRegex = new RegExp(pattern, "iu");
    }

    this.rules = nextRules;
    this.ruleMap = nextRuleMap;
    this.allowedWords = nextAllowed;
    this.combinedRegex = nextCombinedRegex;
    this.lastLoadedAt = Date.now();
    this.isReady = true;
  }

  getRules(): FilterRule[] {
    this.triggerBackgroundRevalidateIfStale();
    return this.rules;
  }

  /**
   * Fast scan for prohibited words using the single pre-compiled regex.
   * Returns immediately from memory.
   */
  scanProhibitedWords(input: string): { matchedWord: string; rule: FilterRule } | null {
    this.triggerBackgroundRevalidateIfStale();
    if (!this.combinedRegex || !input) return null;

    const normalized = toEnglishDigits(input);
    const match = normalized.match(this.combinedRegex) || input.match(this.combinedRegex);
    if (!match) return null;

    const matchedWord = String(match[1] || match[0] || "").trim();
    if (!matchedWord || this.allowedWords.has(matchedWord.toLowerCase())) {
      return null;
    }

    const rule =
      this.ruleMap.get(matchedWord.toLowerCase()) ||
      this.rules.find((r) => String(r.v || "").trim().toLowerCase() === matchedWord.toLowerCase()) || {
        id: 0,
        type: "word",
        path: "bmsgs",
        v: matchedWord,
      };

    return { matchedWord, rule };
  }

  /**
   * Fail-closed text processing for private messages.
   * If cache is uninitialized, or an error occurs, it blocks safely (fail-closed)
   * instead of leaking unmoderated private messages.
   */
  processTextStrict(text: string): FilterResult {
    try {
      this.triggerBackgroundRevalidateIfStale();

      // Fail-closed if cache is not yet ready
      if (!this.isReady && this.rules.length === 0) {
        return {
          allowed: false,
          reason: "خدمة الفلترة قيد التهيئة، يرجى المحاولة بعد قليل",
        };
      }

      const cleanText = String(text ?? "").trim();
      if (!cleanText) {
        return { allowed: true };
      }

      const hit = this.scanProhibitedWords(cleanText);
      if (hit) {
        return {
          allowed: false,
          matchedWord: hit.matchedWord,
          rule: hit.rule,
          actionPath: String(hit.rule.path || "bmsgs"),
          reason: hit.rule.path === "wmsgs" ? "الرسالة تحتوي على عبارات خاضعة للمراقبة" : "الرسالة تحتوي على عبارات محظورة",
        };
      }

      return { allowed: true };
    } catch (err) {
      console.error("[FilterService] processTextStrict fail-closed trigger:", err);
      // Fail-closed on error
      return {
        allowed: false,
        reason: "تعذر فحص أمان الرسالة حالياً",
      };
    }
  }

  /**
   * Fast text processing for public/room messages with background revalidation.
   */
  processText(text: string): FilterResult {
    this.triggerBackgroundRevalidateIfStale();
    const cleanText = String(text ?? "").trim();
    if (!cleanText) return { allowed: true };

    const hit = this.scanProhibitedWords(cleanText);
    if (hit) {
      return {
        allowed: false,
        matchedWord: hit.matchedWord,
        rule: hit.rule,
        actionPath: String(hit.rule.path || "bmsgs"),
      };
    }
    return { allowed: true };
  }
}

// Global shared singleton for fast module-level access
let globalFilterService: FilterService | null = null;

export function getFilterService(): FilterService {
  if (!globalFilterService) {
    globalFilterService = new FilterService();
  }
  return globalFilterService;
}

export async function warmFilterCache(): Promise<void> {
  await getFilterService().warmFilterCache();
}
