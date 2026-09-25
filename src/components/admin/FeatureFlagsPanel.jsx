import { useEffect, useState } from "react";
import { Loader2, AlertCircle, MessageSquareText, Database } from "lucide-react";
import { adminGetFlags, adminSetFlags } from "../../lib/flagsApi";
import { addToast } from "../Toast";

const FLAG_META = [
  {
    key: "chatbot",
    label: "Chatbot",
    description: "Show the AI chat widget to every visitor, not just the logged-in admin.",
    icon: MessageSquareText,
  },
  {
    key: "migrationGenerator",
    label: "Migration Generator",
    description: "Let every visitor use the Migration Generator tab in SQL Formatter, not just the logged-in admin.",
    icon: Database,
  },
];

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savingKey, setSavingKey] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setFlags(await adminGetFlags());
      } catch (err) {
        setError(err.message || "Failed to load feature flags.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleToggle = async (key, next) => {
    // Optimistic — flip immediately, revert on failure so the switch
    // never silently disagrees with what's actually saved.
    setFlags((prev) => ({ ...prev, [key]: next }));
    setSavingKey(key);
    setError(null);
    try {
      const updated = await adminSetFlags({ [key]: next });
      setFlags(updated);
      addToast({ title: `${FLAG_META.find((f) => f.key === key)?.label} ${next ? "enabled" : "disabled"} for everyone.`, type: "success" });
    } catch (err) {
      setFlags((prev) => ({ ...prev, [key]: !next }));
      setError(err.message || "Failed to update feature flag.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-card-foreground mb-1">Feature Flags</h3>
      <p className="text-xs text-muted-foreground mb-4">
        These tools are always available to you while logged in as admin. Turn a flag on to make it
        available to every site visitor too.
      </p>

      {error && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading flags...
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {FLAG_META.map(({ key, label, description, icon: Icon }) => (
            <div
              key={key}
              className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/60 p-3"
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium">{label}</div>
                  <div className="text-xs text-muted-foreground">{description}</div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={!!flags?.[key]}
                aria-label={`Toggle ${label} for all visitors`}
                disabled={savingKey === key}
                onClick={() => handleToggle(key, !flags?.[key])}
                className={`relative shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-60 ${
                  flags?.[key] ? "bg-foreground" : "bg-muted"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-background transition-transform ${
                    flags?.[key] ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
