import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Terminal, Sun, Moon, Menu, X, Cpu } from "lucide-react";
import { cn } from "../lib/utils";
import { useTheme } from "../hooks/use-theme";

const TABS = [
  { id: "home", label: "Home" },
  { id: "json", label: "JSON Formatter" },
  { id: "sql", label: "SQL Formatter" },
  { id: "diff", label: "Diff Checker" },
  { id: "base64", label: "Base64 Converter" },
  { id: "jwt", label: "JWT Decoder" },
  { id: "stringify", label: "Stringify ↔ JSON" },
];

export default function Navbar({
  activeTab,
  onTabChange,
  devMode,
  onDevModeToggle,
}) {
  const { theme, toggle } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const tabRefs = useRef({});
  const tabsWrapperRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0, opacity: 0 });
  const [glowKey, setGlowKey] = useState(0);
  const isFirstRun = useRef(true);

  const measure = () => {
    const el = tabRefs.current[activeTab];
    const wrapper = tabsWrapperRef.current;
    if (el && wrapper) {
      const elRect = el.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      setIndicator({
        left: elRect.left - wrapperRect.left,
        width: elRect.width,
        opacity: 1,
      });
    } else {
      setIndicator((i) => ({ ...i, opacity: 0 }));
    }
  };

  useLayoutEffect(() => {
    measure();

    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }
    setGlowKey((k) => k + 1);
  }, [activeTab]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeTab]);

  return (
    <nav
      className={cn(
        "sticky top-0 z-40 w-full border-b backdrop-blur-xl transition-colors",
        devMode
          ? "border-white/10 bg-[#0a0a12]/75"
          : "border-border bg-background/80",
      )}
    >
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-5 h-14 flex items-center justify-between gap-3">
        <button
          onClick={() => onTabChange("home")}
          className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity"
        >
          <div
            className={cn(
              "flex items-center justify-center w-7 h-7 rounded-lg transition-all",
              devMode
                ? "studio-glow"
                : "bg-foreground text-background",
            )}
            style={devMode ? { background: "var(--dev-gradient)" } : undefined}
          >
            <Terminal className={cn("h-4 w-4", devMode ? "text-[#0b0d10]" : "text-white")} />
          </div>
          <div className="hidden sm:block">
            <span
              className={cn(
                "font-bold text-sm tracking-tight",
                devMode && "gradient-text",
              )}
            >
              DevToolkit
            </span>
            <span className="text-xs text-muted-foreground ml-1.5 hidden lg:inline">
              Your all-in-one dev utilities
            </span>
          </div>
        </button>

        <div
          ref={tabsWrapperRef}
          className="hidden lg:flex flex-1 relative min-w-0"
        >
          <div className="flex items-center gap-1 w-full justify-center overflow-x-auto relative">
            {/* Sliding active-tab indicator */}
            <span
              className={cn(
                "absolute top-1/2 h-8 rounded-lg pointer-events-none",
                "transition-[left,width,opacity] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]",
                devMode ? "bg-white/10" : "bg-accent",
              )}
              style={{
                left: indicator.left,
                width: indicator.width,
                opacity: indicator.opacity,
                transform: "translateY(-50%)",
              }}
            />
            <span
              className={cn(
                "absolute bottom-0 h-0.5 rounded-full pointer-events-none",
                "transition-[left,width,opacity] duration-500 ease-[cubic-bezier(0.65,0,0.35,1)]",
                devMode ? "" : "bg-foreground",
              )}
              style={{
                left: indicator.width ? indicator.left + indicator.width / 2 - 10 : 0,
                width: indicator.width ? 20 : 0,
                opacity: indicator.opacity,
                background: devMode ? "var(--dev-gradient)" : undefined,
              }}
            />
            {TABS.filter((t) => t.id !== "home").map((tab) => (
              <NavTab
                key={tab.id}
                tab={tab}
                isActive={activeTab === tab.id}
                devMode={devMode}
                glowKey={glowKey}
                onClick={() => onTabChange(tab.id)}
                registerRef={(el) => (tabRefs.current[tab.id] = el)}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onDevModeToggle}
            title="Toggle Dev Mode"
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200",
              devMode
                ? "border-white/15 text-white studio-glow shimmer-hover"
                : "border-border text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            style={devMode ? { background: "rgba(255,255,255,0.08)" } : undefined}
          >
            <Cpu className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {devMode ? "EXIT DEV" : "DEV MODE"}
            </span>
          </button>
          <button
            onClick={toggle}
            className={cn(
              "p-2 rounded-lg transition-all",
              devMode
                ? "text-white/60 hover:text-white hover:bg-white/8"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            title="Toggle theme"
          >
            {theme === "dark" || devMode ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <button
            className={cn(
              "lg:hidden p-2 rounded-lg transition-all",
              devMode
                ? "text-white/60 hover:text-white hover:bg-white/8"
                : "text-muted-foreground hover:text-foreground hover:bg-accent",
            )}
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? (
              <X className="h-4 w-4" />
            ) : (
              <Menu className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div
          className={cn(
            "lg:hidden border-t backdrop-blur-xl",
            devMode
              ? "border-white/10 bg-[#0a0a12]/95"
              : "border-border bg-background/95",
          )}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                setMobileOpen(false);
              }}
              className={cn(
                "w-full text-left px-4 py-3 text-sm transition-colors",
                activeTab === tab.id
                  ? devMode
                    ? "bg-white/10 text-white font-medium"
                    : "bg-accent text-foreground font-medium"
                  : devMode
                    ? "text-white/55 hover:bg-white/5 hover:text-white"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
          <div
            className={cn(
              "px-4 py-2 border-t",
              devMode ? "border-white/10" : "border-border",
            )}
          >
            <button
              onClick={onDevModeToggle}
              className={cn(
                "w-full text-left px-2 py-2 text-sm transition-colors rounded-lg flex items-center gap-2",
                devMode ? "gradient-text font-medium" : "text-muted-foreground",
              )}
            >
              <Cpu className="h-3.5 w-3.5" />
              {devMode ? "Exit Dev Mode" : "Dev Mode"}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

function NavTab({ tab, isActive, devMode, glowKey, onClick, registerRef }) {
  return (
    <button
      ref={registerRef}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 text-sm rounded-lg transition-colors duration-200 relative whitespace-nowrap z-10",
        isActive
          ? devMode
            ? "text-white font-medium"
            : "text-foreground font-medium"
          : devMode
            ? "text-white/55 hover:text-white"
            : "text-muted-foreground hover:text-foreground",
      )}
    >
      {isActive && (
        <span
          key={glowKey}
          className="absolute inset-0 rounded-lg pointer-events-none nav-tab-landing"
        />
      )}
      {tab.label}
    </button>
  );
}
