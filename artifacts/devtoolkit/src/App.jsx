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

  useEffect(() => {
    const saved = localStorage.getItem("devtoolkit_theme") || "dark";
    if (saved === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, []);

  const renderPage = () => {
    switch (activeTab) {
      case "home": return <HomePage onTabChange={setActiveTab} />;
      case "json": return <JsonFormatter />;
      case "sql": return <SqlFormatter />;
      case "stringify": return <StringifyConverter />;
      case "diff": return <DiffChecker />;
      default: return <HomePage onTabChange={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />
      <main>{renderPage()}</main>
      <ToastContainer />
    </div>
  );
}
