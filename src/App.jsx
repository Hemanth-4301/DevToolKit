import { useState, useEffect } from "react";
import Navbar from "./components/Navbar";
import HomePage from "./pages/HomePage";
import JsonFormatter from "./pages/JsonFormatter";
import SqlFormatter from "./pages/SqlFormatter";
import Base64Converter from "./pages/Base64Converter";
import StringifyConverter from "./pages/StringifyConverter";
import DiffChecker from "./pages/DiffChecker";
import { ToastContainer } from "./components/Toast";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [devMode, setDevMode] = useState(() => {
    const saved = localStorage.getItem("devtoolkit_devmode");
    return saved !== null ? JSON.parse(saved) : false;
  });

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

  return (
    <div
      className={`min-h-screen bg-background text-foreground scanline-overlay`}
    >
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        devMode={devMode}
        onDevModeToggle={() => setDevMode((d) => !d)}
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
          <DiffChecker />
        </section>

        <section className={activeTab === "stringify" ? "block" : "hidden"}>
          <StringifyConverter />
        </section>
      </main>
      <ToastContainer />
    </div>
  );
}
