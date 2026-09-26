import { useEffect, useMemo, useRef, useState } from "react";
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
  Zap,
  XCircle,
  Trash2,
  Upload,
  FileSpreadsheet,
} from "lucide-react";
import * as XLSX from "xlsx";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { syntaxHighlighting } from "@codemirror/language";
import { cn } from "../lib/utils";
import { addToast } from "./Toast";
import { testMigrationConnection, generateMigrationScript, executeMigration } from "../lib/migrationApi";
import { splitQueries } from "../lib/migrationQuerySplit";
import { languageExtensionFor } from "../lib/detectLanguage";
import { cmTheme, lightHighlight, darkHighlight } from "../lib/codeMirrorTheme";

const sqlLanguage = languageExtensionFor("sql");

const CREDS_STORAGE_KEY = "devtoolkit_migration_creds";
const TARGET_CREDS_STORAGE_KEY = "devtoolkit_migration_target_creds";

const EMPTY_CREDS = { server: "", database: "", username: "", password: "", port: "1433" };

function credsComplete(c) {
  return !!(c.server?.trim() && c.database?.trim() && c.username?.trim() && c.password);
}

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
  // Both regular dark mode and Dev Mode add the "dark" class to <html>
  // (see App.jsx) — mirrors SharedSnippet.jsx's approach so the editor
  // theme reacts to the same toggle everywhere in the app.
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => {
      setIsDark(root.classList.contains("dark"));
    });
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  const sqlExtensions = useMemo(() => {
    const exts = [cmTheme, syntaxHighlighting(isDark ? darkHighlight : lightHighlight), EditorView.lineWrapping];
    if (sqlLanguage) exts.push(sqlLanguage);
    return exts;
  }, [isDark]);
  // Used for the generated-script viewer instead of CodeMirror's own
  // `editable={false}` prop — that flag also sets EditorState.readOnly,
  // which suppresses parts of the default keymap (Mod-a/select-all,
  // Mod-c/copy) along with editing. changeFilter blocks only actual
  // content changes, so selection, copy, and Ctrl+A/Ctrl+C/Ctrl+X all
  // keep working normally; there's just nothing for Ctrl+X to delete.
  const readOnlyFilter = useMemo(() => EditorState.changeFilter.of(() => false), []);
  const scriptExtensions = useMemo(() => [...sqlExtensions, readOnlyFilter], [sqlExtensions, readOnlyFilter]);

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
  const [uploadError, setUploadError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext)) {
      setUploadError("Only .xlsx, .xls, or .csv files are supported.");
      return;
    }
    setUploadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        // Take first column of each row, skip header if it looks like a label
        const values = rows
          .map((row) => String(row[0] ?? "").trim())
          .filter(Boolean);
        // Skip header row if first value looks like a column label (no dots, no spaces, short word)
        const firstIsHeader =
          values.length > 0 &&
          /^(query|queries|table|tables|name|sp|proc|procedure|object|input)$/i.test(values[0]);
        const entries = firstIsHeader ? values.slice(1) : values;
        if (entries.length === 0) {
          setUploadError("No data found in the first column.");
          return;
        }
        const joined = entries.join("\n");
        setQueriesText((prev) => (prev.trim() ? prev.trimEnd() + "\n" + joined : joined));
        setGeneratedQueries(null);
        addToast({ title: `Loaded ${entries.length} entr${entries.length === 1 ? "y" : "ies"} from ${file.name}`, type: "success" });
      } catch {
        setUploadError("Failed to read file — make sure it's a valid Excel or CSV file.");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const [generating, setGenerating] = useState(false);
  const [generateStep, setGenerateStep] = useState(0);
  const [generateError, setGenerateError] = useState(null);
  const [script, setScript] = useState("");
  const [copied, setCopied] = useState(false);
  // Snapshot of exactly what was generated — execution re-runs against
  // this rather than re-reading live form state, so what gets executed
  // always matches what the admin reviewed as the generated script.
  const [generatedQueries, setGeneratedQueries] = useState(null);

  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeStep, setExecuteStep] = useState(0);
  const [executeError, setExecuteError] = useState(null);
  const [executeResults, setExecuteResults] = useState(null);

  const updateCred = (field, value) => {
    setCreds((prev) => ({ ...prev, [field]: value }));
    setTestStatus("idle");
    // Changing where Execute would read from/write to after a script was
    // already reviewed is exactly the kind of drift that snapshot exists
    // to prevent — require a fresh Generate before allowing execution.
    setGeneratedQueries(null);
  };

  const updateTargetCred = (field, value) => {
    setTargetCreds((prev) => ({ ...prev, [field]: value }));
    setTargetTestStatus("idle");
    setGeneratedQueries(null);
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
      setGenerateError("Enter at least one query, table name, or stored procedure name.");
      return;
    }
    if (!credsComplete(creds)) {
      setGenerateError("Fill in all Source Database fields before generating.");
      return;
    }
    if (crossDbMode && !credsComplete(targetCreds)) {
      setGenerateError("Fill in all Target Database fields, or turn off cross-DB migration.");
      return;
    }
    setGenerating(true);
    setGenerateError(null);
    setGenerateStep(0);
    setExecuteResults(null);
    setExecuteError(null);

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
      // Snapshot exactly what was just generated — Execute on Target
      // replays this, not whatever the form happens to contain later.
      setGeneratedQueries(queries);

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

  const handleClearScript = () => {
    setScript("");
    setGeneratedQueries(null);
    setExecuteResults(null);
    setExecuteError(null);
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

  const handleExecute = async () => {
    setShowExecuteConfirm(false);
    setExecuting(true);
    setExecuteError(null);
    setExecuteResults(null);
    setExecuteStep(0);

    const stepTimer = setInterval(() => {
      setExecuteStep((s) => Math.min(s + 1, GENERATE_STEPS.length - 1));
    }, 900);

    try {
      const result = await executeMigration({
        source: creds,
        target: targetCreds,
        queries: generatedQueries,
        includeDelete,
        includeIdentityInsert,
      });
      setExecuteResults(result.results || []);
      const allOk = (result.results || []).every((r) => r.ok);
      addToast({
        title: allOk ? "Migration executed successfully!" : "Migration stopped partway — see results below.",
        type: allOk ? "success" : "error",
      });
    } catch (err) {
      setExecuteError(err.message || "Failed to execute migration.");
    } finally {
      clearInterval(stepTimer);
      setExecuting(false);
    }
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
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">Queries / Tables</h3>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {queryCount} {queryCount === 1 ? "entry" : "entries"} detected
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { handleFileUpload(e.target.files?.[0]); e.target.value = ""; }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload .xlsx, .xls, or .csv — first column should contain table names, queries, or stored proc names"
              className="flex items-center gap-1 px-2 py-0.5 rounded border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Upload className="h-3 w-3" /> Upload file
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeDelete}
                onChange={(e) => {
                  setIncludeDelete(e.target.checked);
                  setGeneratedQueries(null);
                }}
                className="accent-foreground"
              />
              Include DELETE statements
            </label>
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={includeIdentityInsert}
                onChange={(e) => {
                  setIncludeIdentityInsert(e.target.checked);
                  setGeneratedQueries(null);
                }}
                className="accent-foreground"
              />
              Include SET IDENTITY_INSERT ON/OFF
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={
                generating ||
                queryCount === 0 ||
                !credsComplete(creds) ||
                (crossDbMode && !credsComplete(targetCreds))
              }
              title={
                queryCount === 0
                  ? "Enter at least one query, table name, or stored procedure name."
                  : !credsComplete(creds)
                  ? "Fill in all Source Database fields."
                  : crossDbMode && !credsComplete(targetCreds)
                  ? "Fill in all Target Database fields, or turn off cross-DB migration."
                  : undefined
              }
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
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
        </div>

        {crossDbMode && !credsComplete(targetCreds) && (
          <div className="flex items-center gap-1.5 mb-3 text-xs text-amber-500">
            <AlertCircle className="h-3.5 w-3.5" /> Fill in the Target Database fields above to enable Generate.
          </div>
        )}

        <div
          className="rounded-lg border border-border overflow-hidden [&_.cm-editor]:min-h-[180px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            handleFileUpload(file);
          }}
        >
          <CodeMirror
            value={queriesText}
            onChange={(value) => {
              setQueriesText(value);
              setGeneratedQueries(null);
            }}
            theme="none"
            extensions={sqlExtensions}
            placeholder={`cn.tblRedundExcelValidation\nselect * from rp.tblReportConfig where ReportConfigName in ('A','B')\nselect * from dt.tblDispatcher where DispatcherTaskName in ('C','D')`}
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
            minHeight="180px"
          />
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          Enter SELECT queries, bare table names (e.g. <code className="font-mono">cn.tblFoo</code>), or stored procedure names — one per line. Or upload an Excel/CSV file where the first column lists them.
        </p>

        {uploadError && (
          <div className="flex items-start gap-2 mt-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {generateError && (
          <div className="flex items-start gap-2 mt-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{generateError}</span>
          </div>
        )}
      </div>

      {generating && <GeneratingOverlay step={generateStep} />}

      {script && !generating && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold">Generated Script</h3>
            <div className="flex flex-wrap items-center gap-2">
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
              {crossDbMode && (
                <button
                  onClick={() => setShowExecuteConfirm(true)}
                  disabled={executing || !generatedQueries}
                  title={!generatedQueries ? "Re-generate first — the query box or options changed since this script was built." : undefined}
                  className="flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap className="h-3 w-3" /> Execute on Target
                </button>
              )}
              <div className="w-px h-4 bg-border" />
              <button
                onClick={handleClearScript}
                title="Clear generated script"
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded border border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 className="h-3 w-3" /> Clear
              </button>
            </div>
          </div>
          {!generatedQueries && (
            <div className="flex items-center gap-1.5 mb-2 text-xs text-amber-500">
              <AlertCircle className="h-3.5 w-3.5" /> Queries or options changed — re-generate to refresh this script.
            </div>
          )}
          <div
            className="rounded-lg border border-border overflow-hidden [&_.cm-editor]:max-h-[500px] [&_.cm-scroller]:overflow-auto"
            onKeyDown={(e) => {
              // Handled explicitly rather than left to CodeMirror/the
              // browser's native selection: a native "select all" here
              // could span the whole .cm-editor including the .cm-gutters
              // line-number column, so Ctrl+C ends up copying line numbers
              // along with the text. Bypassing selection entirely and
              // copying the plain `script` string guarantees only the
              // actual SQL is ever copied.
              const key = e.key.toLowerCase();
              if (!(e.ctrlKey || e.metaKey) || (key !== "a" && key !== "c" && key !== "x")) return;
              e.preventDefault();

              if (key === "a") {
                const contentEl = e.currentTarget.querySelector(".cm-content");
                if (contentEl) {
                  const range = document.createRange();
                  range.selectNodeContents(contentEl);
                  const sel = window.getSelection();
                  sel.removeAllRanges();
                  sel.addRange(range);
                }
                return;
              }

              // Ctrl+C / Ctrl+X: script is read-only, so both just copy —
              // there's nothing for a "cut" to delete.
              navigator.clipboard.writeText(script);
              addToast({ title: "Script copied!", type: "success" });
            }}
          >
            <CodeMirror
              value={script}
              theme="none"
              extensions={scriptExtensions}
              basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
            />
          </div>
        </div>
      )}

      {executing && <GeneratingOverlay step={executeStep} title="Executing on target database" />}

      {executeError && !executing && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{executeError}</span>
        </div>
      )}

      {executeResults && !executing && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-sm font-semibold mb-3">Execution Results</h3>
          <div className="flex flex-col gap-2">
            {executeResults.map((r, i) => (
              <div
                key={`${r.schema}.${r.table}-${i}`}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-3 text-xs",
                  r.ok
                    ? "border-green-500/20 bg-green-500/10 text-green-500"
                    : "border-red-500/20 bg-red-500/10 text-red-400",
                )}
              >
                {r.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                ) : (
                  <XCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                )}
                <div>
                  <div className="font-medium">
                    {r.schema}.{r.table}
                  </div>
                  {r.ok ? (
                    <div>{r.rowsAffected} row(s) migrated.</div>
                  ) : (
                    <div>Rolled back — {r.error}</div>
                  )}
                </div>
              </div>
            ))}
            {executeResults.some((r) => !r.ok) && (
              <p className="text-xs text-muted-foreground mt-1">
                Execution stopped at the first failure. Tables listed above that succeeded are
                already committed; tables not listed were never attempted.
              </p>
            )}
          </div>
        </div>
      )}

      {showExecuteConfirm && (
        <ExecuteConfirmDialog
          tableCount={generatedQueries?.length || 0}
          targetLabel={`${targetCreds.server || "?"} / ${targetCreds.database || "?"}`}
          onCancel={() => setShowExecuteConfirm(false)}
          onConfirm={handleExecute}
        />
      )}
    </div>
  );
}

function ExecuteConfirmDialog({ tableCount, targetLabel, onCancel, onConfirm }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-3 text-red-400">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <h3 className="text-sm font-semibold">Execute migration on target?</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          This will run the generated DELETE/INSERT statements for {tableCount}{" "}
          {tableCount === 1 ? "table" : "tables"} directly against <strong className="text-foreground">{targetLabel}</strong>.
          Each table runs in its own transaction and rolls back automatically on failure, but this is a real write —
          review the script above before continuing.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-500 text-white hover:bg-red-600 transition-colors"
          >
            Yes, execute
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratingOverlay({ step, title = "Generating migration script" }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card p-8 flex flex-col items-center justify-center gap-4">
      <div className="migration-liquid-loader">
        <div className="migration-liquid-fill" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground transition-all duration-300">
          {GENERATE_STEPS[step]}
        </span>
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
