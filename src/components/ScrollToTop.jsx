import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "../lib/utils";

export default function ScrollToTop({ threshold = 300 }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setVisible(window.scrollY > threshold);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  const handleClick = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Scroll to top"
      className={cn(
        "fixed bottom-6 right-6 z-40 h-11 w-11 rounded-full border border-border bg-card/95 backdrop-blur shadow-lg flex items-center justify-center text-foreground hover:bg-accent hover:scale-105 active:scale-95 transition-all duration-200",
        visible
          ? "opacity-100 pointer-events-auto translate-y-0"
          : "opacity-0 pointer-events-none translate-y-2",
      )}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
}
