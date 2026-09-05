import { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import JsonFormatter from "./pages/JsonFormatter";
import SqlFormatter from "./pages/SqlFormatter";
import Base64Converter from "./pages/Base64Converter";
import StringifyConverter from "./pages/StringifyConverter";
import DiffChecker from "./pages/DiffChecker";
import JwtDecoder from "./pages/JwtDecoder";
import HtmlPreviewer from "./pages/HtmlPreviewer";
import CodeShareLanding from "./pages/CodeShareLanding";
import SharedSnippet from "./pages/SharedSnippet";
import { ToastContainer } from "./components/Toast";
import ChatWidget from "./components/ChatWidget";
import PinUnlockModal from "./components/PinUnlockModal";

const CHAT_UNLOCK_KEY = "devtoolkit_chat_unlocked";

// Only "home" and "code-share" are real URLs — every other tab (json,
// sql, jwt, ...) is reached purely by clicking the navbar and lives in
// memory only, so that any other top-level path the user types (e.g.
// "/json", "/anything") is free to be used as a Code Share slug instead.
const TAB_ROUTES = {
  home: "/",
  "code-share": "/code-share",
};
const ROUTE_TABS = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab]),
);
const URL_BACKED_TABS = new Set(Object.keys(TAB_ROUTES));

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();

  // A path is a "slug route" (potential shared-snippet link) when it's a
  // single top-level segment that isn't "/" or "/code-share" — e.g. "/hem"
  // or even "/json", since the JSON Formatter tool no longer owns that URL.
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isSlugRoute = pathSegments.length === 1 && !(location.pathname in ROUTE_TABS);

  // "home" and "code-share" are real routes; every other tab (json, sql,
  // ...) is pure in-memory state that never touches the URL, so the URL
  // alone can't tell them apart from "home" — `lastTab` is the source of
  // truth for which of those is showing, and is only reset by an explicit
  // navigation to "/" or "/code-share" (including via browser back/forward,
  // handled by the effect below).
  const [lastTab, setLastTab] = useState("home");
  // Guards against the URL-driven sync effect clobbering a same-tick
  // setActiveTab("json")-style call: navigating to "/" for an in-memory
  // tab also matches ROUTE_TABS["/"] === "home", which would otherwise
  // overwrite the tab we just set with "home" once the route change lands.
  const pendingTabRef = useRef(null);
  useEffect(() => {
    if (location.pathname in ROUTE_TABS) {
      if (pendingTabRef.current && !URL_BACKED_TABS.has(pendingTabRef.current)) {
        setLastTab(pendingTabRef.current);
        pendingTabRef.current = null;
        return;
      }
      setLastTab(ROUTE_TABS[location.pathname]);
    }
  }, [location.pathname]);

  const activeTab = isSlugRoute ? null : lastTab;
  const setActiveTab = (tab) => {
    setLastTab(tab);
    if (URL_BACKED_TABS.has(tab)) {
      navigate(TAB_ROUTES[tab]);
    } else if (isSlugRoute || location.pathname === "/code-share") {
      // Coming from a slug page or the Code Share landing page — both are
      // real routes — hop back to "/" so the in-memory tab can render.
      pendingTabRef.current = tab;
      navigate("/");
    }
  };
  const [devMode, setDevMode] = useState(() => {
    const saved = localStorage.getItem("devtoolkit_devmode");
    return saved !== null ? JSON.parse(saved) : false;
  });
  const [chatUnlocked, setChatUnlocked] = useState(() => {
    return localStorage.getItem(CHAT_UNLOCK_KEY) === "true";
  });
  const [showPinModal, setShowPinModal] = useState(false);

  useEffect(() => {
    localStorage.setItem("devtoolkit_devmode", JSON.stringify(devMode));
  }, [devMode]);

  useEffect(() => {
    const saved = localStorage.getItem("devtoolkit_theme") || "light";
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (devMode) {
      root.classList.add("dev-mode");
      root.classList.add("dark");
    } else {
      root.classList.remove("dev-mode");
      const saved = localStorage.getItem("devtoolkit_theme") || "light";
      if (saved !== "dark") root.classList.remove("dark");
    }
  }, [devMode]);

  const handleChatUnlock = () => {
    setChatUnlocked(true);
    localStorage.setItem(CHAT_UNLOCK_KEY, "true");
    setShowPinModal(false);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        devMode={devMode}
        onDevModeToggle={() => setDevMode((d) => !d)}
        onLogoTripleClick={() => setShowPinModal(true)}
      />
      <main className="overflow-x-hidden">
        {isSlugRoute ? (
          <Routes>
            <Route path="/:slug" element={<SharedSnippet />} />
          </Routes>
        ) : (
          <>
            <section className={activeTab === "home" ? "block" : "hidden"}>
              <HomePage onTabChange={setActiveTab} devMode={devMode} />
            </section>

            <section className={activeTab === "json" ? "block" : "hidden"}>
              <JsonFormatter />
            </section>

            <section className={activeTab === "sql" ? "block" : "hidden"}>
              <SqlFormatter />
            </section>

            <section className={activeTab === "base64" ? "block" : "hidden"}>
              <Base64Converter />
            </section>

            <section className={activeTab === "diff" ? "block" : "hidden"}>
              <DiffChecker isActive={activeTab === "diff"} />
            </section>

            <section className={activeTab === "stringify" ? "block" : "hidden"}>
              <StringifyConverter />
            </section>

            <section className={activeTab === "jwt" ? "block" : "hidden"}>
              <JwtDecoder />
            </section>

            <section className={activeTab === "html" ? "block" : "hidden"}>
              <HtmlPreviewer />
            </section>

            <section className={activeTab === "code-share" ? "block" : "hidden"}>
              <CodeShareLanding />
            </section>
          </>
        )}
      </main>
      <ToastContainer />
      {chatUnlocked && <ChatWidget />}
      <PinUnlockModal
        open={showPinModal}
        onClose={() => setShowPinModal(false)}
        onSuccess={handleChatUnlock}
      />
    </div>
  );
}
