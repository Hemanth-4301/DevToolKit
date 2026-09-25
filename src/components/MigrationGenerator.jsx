import { useMemo, useState } from "react";
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Copy,
  Check,
  Download,
  PlugZap,
  ArrowRight,
  Database,
  Sparkles,
} from "lucide-react";
import { cn } from "../lib/utils";
import { addToast } from "./Toast";
import { testMigrationConnection, generateMigrationScript } from "../lib/migrationApi";
import { splitQueries } from "../lib/migrationQuerySplit";

const CREDS_STORAGE_KEY = "devtoolkit_migration_creds";
const TARGET_CREDS_STORAGE_KEY = "devtoolkit_migration_target_creds";

const EMPTY_CREDS = { server: "", database: "", username: "", password: "", port: "1433" };

function loadStoredCreds(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...EMPTY_CREDS, ...parsed };
  } catch {
    return null;
  }
}

const GENERATE_STEPS = [
  "Connecting to source database...",
  "Reading table columns...",
  "Fetching rows...",
  "Building INSERT statements...",
  "Almost done...",
];

export default function MigrationGenerator() {
  const stored = useMemo(() => loadStoredCreds(CREDS_STORAGE_KEY), []);
  const [creds, setCreds] = useState(stored || EMPTY_CREDS);
  const [rememberCreds, setRememberCreds] = useState(!!stored);
  const [showPassword, setShowPassword] = useState(false);

  const storedTarget = useMemo(() => loadStoredCreds(TARGET_CREDS_STORAGE_KEY), []);
  const [crossDbMode, setCrossDbMode] = useState(!!storedTarget);
  const [targetCreds, setTargetCreds] = useState(storedTarget || EMPTY_CREDS);
  const [rememberTargetCreds, setRememberTargetCreds] = useState(!!storedTarget);
  const [showTargetPassword, setShowTargetPassword] = useState(false);

  const [testStatus, setTestStatus] = useState("idle"); // idle | testing | ok | error
  const [testError, setTestError] = useState(null);
  const [targetTestStatus, setTargetTestStatus] = useState("idle");
  const [targetTestError, setTargetTestError] = useState(null);

  const [includeDelete, setIncludeDelete] = useState(true);
  const [includeIdentityInsert, setIncludeIdentityInsert] = useState(true);

  const [queriesText, setQueriesText] = useState("");
  const queryCount = useMemo(() => splitQueries(queriesText).length, [queriesText]);

  const [generating, setGenerating] = useState(false);
  const [generateStep, setGenerateStep] = useState(0);
  const [generateError, setGenerateError] = useState(null);
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);

  const updateCred = (field, value) => {
    setCreds((prev) => ({ ...prev, [field]: value }));
    setTestStatus("idle");
  };

  const updateTargetCred = (field, value) => {
    setTargetCreds((prev) => ({ ...prev, [field]: value }));
    setTargetTestStatus("idle");
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    setTestError(null);
    try {
      await testMigrationConnection(creds);
      setTestStatus("ok");
    } catch (err) {
      setTestStatus("error");
      setTestError(err.message || "Connection failed.");
    }
  };

  const handleTestTargetConnection = async () => {
    setTargetTestStatus("testing");
    setTargetTestError(null);
    try {
      await testMigrationConnection(targetCreds);
      setTargetTestStatus("ok");
    } catch (err) {
      setTargetTestStatus("error");
      setTargetTestError(err.message || "Connection failed.");
    }
  };

  const handleGenerate = async () => {
    const queries = splitQueries(queriesText);
    if (queries.length === 0) {
      setGenerateError("Paste at least one SELECT query.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setGenerateStep(0);

    // Purely cosmetic step progression — the request itself is a single
    // call, but stepping through these while it's in flight gives the
    // user something more informative than a static spinner to look at
    // during what can be a multi-second wait for a large migration.
    const stepTimer = setInterval(() => {
      setGenerateStep((s) => Math.min(s + 1, GENERATE_STEPS.length - 1));
    }, 900);

    try {
      const result = await generateMigrationScript({
        source: creds,
        target: crossDbMode ? targetCreds : null,
        queries,
        includeDelete,
        includeIdentityInsert,
      });
      setScript(result.script || "");

      // Credentials are intentionally left as-is here — they persist in
      // this form until the page is refreshed, even if "Save credentials"
      // is off, so a generate-then-tweak-and-regenerate flow doesn't force
      // retyping the password every time.
      if (rememberCreds) {
        localStorage.setItem(CREDS_STORAGE_KEY, JSON.stringify(creds));
      } else {
        localStorage.removeItem(CREDS_STORAGE_KEY);
      }
      if (crossDbMode && rememberTargetCreds) {
        localStorage.setItem(TARGET_CREDS_STORAGE_KEY, JSON.stringify(targetCreds));
      } else {
        localStorage.removeItem(TARGET_CREDS_STORAGE_KEY);
      }

      addToast({ title: "Migration script generated!", type: "success" });
    } catch (err) {
      setGenerateError(err.message || "Failed to generate script.");
    } finally {
      clearInterval(stepTimer);
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!script) return;
    await navigator.clipboard.writeText(script);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    addToast({ title: "Script copied!", type: "success" });
  };

  const handleDownload = () => {
    if (!script) return;
    const blob = new Blob([script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "migration.sql";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-2 mb-3">
          <Database className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Source Database</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <CredField label="Server / Host" value={creds.server} onChange={(v) => updateCred("server", v)} placeholder="192.168.1.50" />
          <CredField label="Database" value={creds.database} onChange={(v) => updateCred("database", v)} placeholder="BajajDev" />
          <CredField label="Username" value={creds.username} onChange={(v) => updateCred("username", v)} placeholder="sa" />
          <CredField
            label="Password"
            type={showPassword ? "text" : "password"}
            value={creds.password}
            onChange={(v) => updateCred("password", v)}
            placeholder="••••••••"
            toggle={
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          />
          <CredField label="Port" value={creds.port} onChange={(v) => updateCred("port", v)} placeholder="1433" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={rememberCreds}
              onChange={(e) => setRememberCreds(e.target.checked)}
              className="accent-foreground"
            />
            Save credentials on this device
          </label>

          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testStatus === "testing"}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-60"
          >
            {testStatus === "testing" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlugZap className="h-3.5 w-3.5" />
            )}
            Test Connection
          </button>
        </div>

        {testStatus === "ok" && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-green-500">
            <CheckCircle2 className="h-3.5 w-3.5" /> Connected successfully.
          </div>
        )}
        {testStatus === "error" && (
          <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> {testError}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
          <input
            type="checkbox"
            checked={crossDbMode}
            onChange={(e) => setCrossDbMode(e.target.checked)}
            className="accent-foreground"
          />
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          Migrate into a different database (cross-DB)
        </label>
        <p className="text-xs text-muted-foreground mt-1 ml-6">
          Reads from Source above, but builds the script using the target database's own
          column types and identity columns — catches mismatches before you run it there.
        </p>

        {crossDbMode && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center gap-2 mb-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Target Database</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <CredField label="Server / Host" value={targetCreds.server} onChange={(v) => updateTargetCred("server", v)} placeholder="192.168.1.99" />
              <CredField label="Database" value={targetCreds.database} onChange={(v) => updateTargetCred("database", v)} placeholder="BajajUAT" />
              <CredField label="Username" value={targetCreds.username} onChange={(v) => updateTargetCred("username", v)} placeholder="sa" />
              <CredField
                label="Password"
                type={showTargetPassword ? "text" : "password"}
                value={targetCreds.password}
                onChange={(v) => updateTargetCred("password", v)}
                placeholder="••••••••"
                toggle={
                  <button type="button" onClick={() => setShowTargetPassword((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground">
                    {showTargetPassword ? "Hide" : "Show"}
                  </button>
                }
              />
              <CredField label="Port" value={targetCreds.port} onChange={(v) => updateTargetCred("port", v)} placeholder="1433" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberTargetCreds}
                  onChange={(e) => setRememberTargetCreds(e.target.checked)}
                  className="accent-foreground"
                />
                Save credentials on this device
              </label>

              <button
                type="button"
                onClick={handleTestTargetConnection}
                disabled={targetTestStatus === "testing"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-60"
              >
                {targetTestStatus === "testing" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <PlugZap className="h-3.5 w-3.5" />
                )}
                Test Connection
              </button>
            </div>

            {targetTestStatus === "ok" && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" /> Connected successfully.
              </div>
            )}
            {targetTestStatus === "error" && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
                <AlertCircle className="h-3.5 w-3.5" /> {targetTestError}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">SELECT Queries</h3>
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {queryCount} {queryCount === 1 ? "query" : "queries"} detected
          </span>
        </div>
        <textarea
          value={queriesText}
          onChange={(e) => setQueriesText(e.target.value)}
          placeholder={`select * from rp.tblReportConfig where ReportConfigName in ('A','B')\nselect * from dt.tblDispatcher where DispatcherTaskName in ('C','D')`}
          className="w-full min-h-[180px] p-3 rounded-lg border border-border bg-background font-mono text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring/30 focus:border-ring/50 transition-colors"
        />

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={includeDelete}
              onChange={(e) => setIncludeDelete(e.target.checked)}
              className="accent-foreground"
            />
            Include DELETE statements
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={includeIdentityInsert}
              onChange={(e) => setIncludeIdentityInsert(e.target.checked)}
              className="accent-foreground"
            />
            Include SET IDENTITY_INSERT ON/OFF
          </label>
        </div>

        {generateError && (
          <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{generateError}</span>
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating || queryCount === 0}
          className="mt-3 flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Generating...
            </>
          ) : (
            "Generate Migration Script"
          )}
        </button>
      </div>

      {generating && <GeneratingOverlay step={generateStep} />}

      {script && !generating && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Generated Script</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors",
                  copied ? "text-green-500" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
              >
                <Download className="h-3 w-3" /> .sql
              </button>
            </div>
          </div>
          <pre className="w-full max-h-[500px] overflow-auto p-3 rounded-lg border border-border bg-background font-mono text-xs whitespace-pre">
            {script}
          </pre>
        </div>
      )}
    </div>
  );
}

function GeneratingOverlay({ step }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-8 flex flex-col items-center justify-center gap-4">
      <div className="migration-loader-glow" />
      <div className="relative flex items-center justify-center h-14 w-14 rounded-2xl bg-foreground text-background">
        <Sparkles className="h-6 w-6 migration-loader-spark" />
      </div>
      <div className="relative flex flex-col items-center gap-1.5">
        <span className="text-sm font-semibold">Generating migration script</span>
        <span className="text-xs text-muted-foreground transition-all duration-300">
          {GENERATE_STEPS[step]}
        </span>
      </div>
      <div className="relative w-full max-w-xs h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="migration-loader-bar h-full rounded-full bg-foreground" />
      </div>
    </div>
  );
}

function CredField({ label, value, onChange, placeholder, type = "text", toggle }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-xs font-medium text-muted-foreground">
        {label}
        {toggle}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring/30 focus:border-ring/50 transition-colors"
      />
    </label>
  );
}
