import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import JsonFormatter from "./pages/JsonFormatter";
import SqlFormatter from "./pages/SqlFormatter";
import StringifyConverter from "./pages/StringifyConverter";
import DiffChecker from "./pages/DiffChecker";
import { ToastContainer } from "./components/Toast";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [devMode, setDevMode] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("devtoolkit_theme") || "dark";
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
      const saved = localStorage.getItem("devtoolkit_theme") || "dark";
      if (saved !== "dark") root.classList.remove("dark");
    }
  }, [devMode]);

  const renderPage = () => {
    switch (activeTab) {
      case "home": return <HomePage onTabChange={setActiveTab} devMode={devMode} />;
      case "json": return <JsonFormatter />;
      case "sql": return <SqlFormatter />;
      case "diff": return <DiffChecker />;
      case "stringify": return <StringifyConverter />;
      default: return <HomePage onTabChange={setActiveTab} devMode={devMode} />;
    }
  };

  return (
    <div className={`min-h-screen bg-background text-foreground scanline-overlay`}>
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} devMode={devMode} onDevModeToggle={() => setDevMode(d => !d)} />
      <main>{renderPage()}</main>
      <ToastContainer />
    </div>
  );
}
