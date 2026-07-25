import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import JsonFormatter from "./pages/JsonFormatter";
import SqlFormatter from "./pages/SqlFormatter";
import Base64Converter from "./pages/Base64Converter";
import StringifyConverter from "./pages/StringifyConverter";
import DiffChecker from "./pages/DiffChecker";
import JwtDecoder from "./pages/JwtDecoder";
import { ToastContainer } from "./components/Toast";
import GradientMesh from "./components/GradientMesh";
import ChatWidget from "./components/ChatWidget";
import PinUnlockModal from "./components/PinUnlockModal";

const CHAT_UNLOCK_KEY = "devtoolkit_chat_unlocked";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
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
      <GradientMesh active={devMode} />
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        devMode={devMode}
        onDevModeToggle={() => setDevMode((d) => !d)}
        onLogoTripleClick={() => setShowPinModal(true)}
      />
      <main className="overflow-x-hidden">
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
