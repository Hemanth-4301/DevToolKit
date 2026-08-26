import { useState, useEffect } from "react";
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
import SharedSnippet, { RESERVED_SLUGS } from "./pages/SharedSnippet";
import { ToastContainer } from "./components/Toast";
import ChatWidget from "./components/ChatWidget";
import PinUnlockModal from "./components/PinUnlockModal";

const CHAT_UNLOCK_KEY = "devtoolkit_chat_unlocked";

// Tab ids map 1:1 to top-level routes so the existing Navbar/HomePage
// components (which only know about `activeTab` + `onTabChange`) keep
// working unmodified on top of real URLs.
const TAB_ROUTES = {
  home: "/",
  json: "/json",
  sql: "/sql",
  diff: "/diff",
  base64: "/base64",
  html: "/html",
  jwt: "/jwt",
  stringify: "/stringify",
};
const ROUTE_TABS = Object.fromEntries(
  Object.entries(TAB_ROUTES).map(([tab, route]) => [route, tab]),
);

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
  const activeTab = ROUTE_TABS[location.pathname] || "home";
  const setActiveTab = (tab) => navigate(TAB_ROUTES[tab] || "/");
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

  // A path is a "slug route" (potential shared-snippet link) when it's a
  // single top-level segment that isn't one of the known tab routes or
  // other reserved paths — e.g. "/hem", but not "/json" or "/code-share".
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const isSlugRoute =
    pathSegments.length === 1 &&
    !(location.pathname in ROUTE_TABS) &&
    !RESERVED_SLUGS.has(pathSegments[0].toLowerCase());

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
