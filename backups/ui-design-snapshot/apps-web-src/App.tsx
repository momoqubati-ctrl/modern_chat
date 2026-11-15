import { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { useChatStore } from "@newchat/core-client";
import { ChatRoomWorkspace } from "./components/ChatRoomWorkspace.js";
import { LoginScreen } from "./components/LoginScreen.js";
import { NoticeStack } from "./components/NoticeStack.js";
import { RoomInviteModal } from "./components/RoomInviteModal.js";
import {
  normalizeHexColor,
  resolveApiBaseUrl,
  resolveGatewayBaseUrl,
} from "./lib/mediaUrl.js";

const ControlPanelPage = lazy(() => import("./pages/ControlPanelPage.js"));
const AgentPortalPage = lazy(() => import("./pages/AgentPortalPage.js"));
const CarromArenaPage = lazy(() => import("./pages/CarromArenaPage.js"));

const THEME_STORAGE_KEY = "newchat_theme";

function normalizePathname(raw: string): string {
  const clean = (raw || "/").split("?")[0]?.split("#")[0] || "/";
  return clean.length > 1 ? clean.replace(/\/+$/, "") : clean;
}

export function App() {
  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === "light") return false;
      if (saved === "dark") return true;
    } catch {
      // ignore storage errors
    }
    return true;
  });

  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== "undefined" ? normalizePathname(window.location.pathname) : "/",
  );

  const isAuthenticated = useChatStore((s) => s.isAuthenticated);
  const site = useChatStore((s) => s.site);
  const initialize = useChatStore((s) => s.initialize);
  const getSocketClient = useChatStore((s) => s.getSocketClient);

  const toggleTheme = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  const navigate = useCallback((targetPath: string) => {
    if (typeof window === "undefined") return;
    const nextNorm = normalizePathname(targetPath);
    if (normalizePathname(window.location.pathname) !== nextNorm) {
      window.history.pushState({}, "", targetPath);
    }
    setPathname(nextNorm);
  }, []);

  // Initialize API/Gateway & deep-link room on boot
  useEffect(() => {
    let initialRoomId = "";
    try {
      const params = new URLSearchParams(window.location.search);
      initialRoomId = (params.get("room") || "").trim();
    } catch {
      // ignore URL parse error
    }
    void initialize({
      apiUrl: resolveApiBaseUrl(),
      gatewayUrl: resolveGatewayBaseUrl(),
      initialRoomId,
    });
  }, [initialize]);

  // Browser back/forward SPA navigation listener
  useEffect(() => {
    const onPopState = () => {
      setPathname(normalizePathname(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Report page visibility state to real-time socket presence
  useEffect(() => {
    const onVisibility = () => {
      getSocketClient()?.reportVisibility(document.hidden);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [getSocketClient]);

  // Apply dynamic site title & theme CSS custom properties from server bootstrap config
  useEffect(() => {
    if (site?.title || site?.name) {
      document.title = String(site.title || site.name);
    }
    const rootStyle = document.documentElement.style;
    rootStyle.setProperty(
      "--chat-bg",
      normalizeHexColor(site?.colors?.bgcolor, dark ? "#0f172a" : "#f8fafc"),
    );
    rootStyle.setProperty(
      "--chat-accent",
      normalizeHexColor(site?.colors?.hicolor, "#0a6e8c"),
    );
    rootStyle.setProperty(
      "--chat-button",
      normalizeHexColor(site?.colors?.btcolor, "#203d69"),
    );
  }, [site, dark]);

  const routeFallback = (
    <div
      className={`min-h-screen flex flex-col items-center justify-center gap-3 text-sm font-bold ${
        dark ? "bg-slate-950 text-slate-200" : "bg-slate-50 text-slate-800"
      }`}
    >
      <div className="w-8 h-8 rounded-full border-3 border-sky-500 border-t-transparent animate-spin" />
      <span>جارٍ تحميل الصفحة...</span>
    </div>
  );

  const isCpRoute =
    pathname === "/cp" || pathname === "/cp.html" || pathname.startsWith("/cp/");
  const isAgentRoute =
    pathname === "/agent/topup" || pathname === "/agent-topup.html";
  const isCarromRoute = pathname === "/carrom";

  return (
    <div className={dark ? "dark-theme" : "light-theme"}>
      <NoticeStack />
      <RoomInviteModal />

      {isCpRoute ? (
        <Suspense fallback={routeFallback}>
          <ControlPanelPage
            dark={dark}
            onToggleTheme={toggleTheme}
            onBackToChat={() => navigate("/")}
          />
        </Suspense>
      ) : isAgentRoute ? (
        <Suspense fallback={routeFallback}>
          <AgentPortalPage
            dark={dark}
            onToggleTheme={toggleTheme}
            onBackToChat={() => navigate("/")}
          />
        </Suspense>
      ) : isCarromRoute ? (
        <Suspense fallback={routeFallback}>
          <CarromArenaPage
            dark={dark}
            onToggleTheme={toggleTheme}
            onBackToChat={() => navigate("/")}
          />
        </Suspense>
      ) : isAuthenticated ? (
        <ChatRoomWorkspace
          dark={dark}
          onToggleTheme={toggleTheme}
          onNavigate={navigate}
        />
      ) : (
        <LoginScreen
          dark={dark}
          onToggleTheme={toggleTheme}
          onNavigate={navigate}
        />
      )}
    </div>
  );
}
