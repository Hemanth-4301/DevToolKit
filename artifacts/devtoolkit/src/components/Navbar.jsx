import { useState } from "react";
import { Terminal, Sun, Moon, Github, Menu, X, Code2 } from "lucide-react";
import { cn } from "../lib/utils";
import { useTheme } from "../hooks/use-theme";

const TABS = [
  { id: "home", label: "Home" },
  { id: "json", label: "JSON Formatter" },
  { id: "sql", label: "SQL Formatter" },
  { id: "stringify", label: "Stringify ↔ JSON" },
  { id: "diff", label: "Diff Checker" },
];

export default function Navbar({ activeTab, onTabChange }) {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        <button
          onClick={() => onTabChange("home")}
          className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
        >
          <div className="flex items-center justify-center w-7 h-7 rounded-md bg-foreground text-background">
            <Terminal className="h-4 w-4" />
          </div>
          <div className="hidden sm:block">
            <span className="font-bold text-sm tracking-tight">DevToolkit</span>
            <span className="text-xs text-muted-foreground ml-1.5 hidden lg:inline">Your all-in-one dev utilities</span>
          </div>
        </button>

        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {TABS.filter(t => t.id !== "home").map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-all duration-200 relative whitespace-nowrap",
                activeTab === tab.id
                  ? "text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-0.5 bg-foreground rounded-full" />
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggle}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            title="Toggle theme"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all" title="GitHub">
            <Github className="h-4 w-4" />
          </button>
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background/95 backdrop-blur-md">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { onTabChange(tab.id); setMobileOpen(false); }}
              className={cn(
                "w-full text-left px-4 py-3 text-sm transition-colors",
                activeTab === tab.id
                  ? "bg-accent text-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </nav>
  );
}
