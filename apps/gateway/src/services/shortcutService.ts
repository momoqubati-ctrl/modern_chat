import { cuts, getDb } from "@newchat/db";
import { sanitizeHtmlText } from "@newchat/shared";

export interface ShortcutRule {
  id: number;
  text1: string;
  text2: string;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class ShortcutService {
  private cuts: ShortcutRule[] = [];
  private replacementMap = new Map<string, string>();
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
   * Warm the shortcut cache during server startup so no message waits on DB.
   */
  async warmShortcutCache(): Promise<void> {
    await this.fetchAndCompile();
  }

  /**
   * Background revalidation (stale-while-revalidate).
   */
  async revalidateInBackground(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    try {
      await this.fetchAndCompile();
    } catch (err) {
      console.warn("[ShortcutService] Background revalidation warning:", err);
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
    const rows = await db.select().from(cuts);

    const nextCuts: ShortcutRule[] = rows.map((r) => ({
      id: r.id,
      text1: String(r.text1 || "").trim(),
      text2: String(r.text2 || ""),
    })).filter((c) => c.text1.length > 0);

    const nextMap = new Map<string, string>();
    const triggers: string[] = [];

    for (const c of nextCuts) {
      nextMap.set(c.text1, c.text2);
      triggers.push(c.text1);
    }

    let nextRegex: RegExp | null = null;
    if (triggers.length > 0) {
      // Sort triggers by length descending so longer phrases replace before substrings
      const sorted = [...triggers].sort((a, b) => b.length - a.length);
      const escaped = sorted.map((t) => escapeRegex(t));
      // Pre-compile single combined regex with word/whitespace boundaries
      const pattern = `(?<=^| )(${escaped.join("|")})(?= |$|\\n)`;
      nextRegex = new RegExp(pattern, "gu");
    }

    this.cuts = nextCuts;
    this.replacementMap = nextMap;
    this.combinedRegex = nextRegex;
    this.lastLoadedAt = Date.now();
    this.isReady = true;
  }

  getRules(): ShortcutRule[] {
    this.triggerBackgroundRevalidateIfStale();
    return this.cuts;
  }

  /**
   * Fast shortcut replacement using the pre-compiled combined Regex and Map.
   * Runs in memory immediately with stale-while-revalidate refresh.
   */
  replaceShortcuts(data: string): string {
    this.triggerBackgroundRevalidateIfStale();

    const source = String(data ?? "");
    if (!source || !this.combinedRegex || this.replacementMap.size === 0) {
      return sanitizeHtmlText(source);
    }

    let current = source;
    // Max 3 passes to handle nested expansions, breaking immediately when stable
    for (let pass = 0; pass < 3; pass += 1) {
      const next = current.replace(this.combinedRegex, (match) => {
        const rep = this.replacementMap.get(match);
        return rep !== undefined ? rep : match;
      });
      if (next === current) break;
      current = next;
    }

    return sanitizeHtmlText(current);
  }
}

// Global shared singleton for fast module-level access
let globalShortcutService: ShortcutService | null = null;

export function getShortcutService(): ShortcutService {
  if (!globalShortcutService) {
    globalShortcutService = new ShortcutService();
  }
  return globalShortcutService;
}

export async function warmShortcutCache(): Promise<void> {
  await getShortcutService().warmShortcutCache();
}
