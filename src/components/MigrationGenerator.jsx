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
  ChevronDown,
  ChevronUp,
  Server,
  Shield,
  Play,
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
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    const root = document.documentElement;
    const observer = new MutationObserver(() => setIsDark(root.classList.contains("dark")));
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const sqlExtensions = useMemo(() => {
    const exts = [cmTheme, syntaxHighlighting(isDark ? darkHighlight : lightHighlight), EditorView.lineWrapping];
    if (sqlLanguage) exts.push(sqlLanguage);
    return exts;
  }, [isDark]);

  const readOnlyFilter = useMemo(() => EditorState.changeFilter.of(() => false), []);
  const scriptExtensions = useMemo(() => [...sqlExtensions, readOnlyFilter], [sqlExtensions, readOnlyFilter]);

  const stored = useMemo(() => loadStoredCreds(CREDS_STORAGE_KEY), []);
  const [creds, setCreds] = useState(stored || EMPTY_CREDS);
  const [rememberCreds, setRememberCreds] = useState(!!stored);
  const [showPassword, setShowPassword] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(true);

  const storedTarget = useMemo(() => loadStoredCreds(TARGET_CREDS_STORAGE_KEY), []);
  const [crossDbMode, setCrossDbMode] = useState(!!storedTarget);
  const [targetCreds, setTargetCreds] = useState(storedTarget || EMPTY_CREDS);
  const [rememberTargetCreds, setRememberTargetCreds] = useState(!!storedTarget);
  const [showTargetPassword, setShowTargetPassword] = useState(false);

  const [testStatus, setTestStatus] = useState("idle");
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
        const values = rows.map((row) => String(row[0] ?? "").trim()).filter(Boolean);
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
  const [generatedQueries, setGeneratedQueries] = useState(null);

  const [showExecuteConfirm, setShowExecuteConfirm] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeStep, setExecuteStep] = useState(0);
  const [executeError, setExecuteError] = useState(null);
  const [executeResults, setExecuteResults] = useState(null);

  const updateCred = (field, value) => {
    setCreds((prev) => ({ ...prev, [field]: value }));
    setTestStatus("idle");
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
      setGeneratedQueries(queries);

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

  const sourceConnected = testStatus === "ok";
  const targetConnected = targetTestStatus === "ok";

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">

      {/* ── Step 1: Source DB ── */}
      <StepCard
        step={1}
        title="Source Database"
        subtitle={creds.server && creds.database ? `${creds.server} / ${creds.database}` : "Where data is read from"}
        icon={<Server className="h-4 w-4" />}
        status={testStatus}
        open={sourceOpen}
        onToggle={() => setSourceOpen((v) => !v)}
      >
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
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                {showPassword ? "Hide" : "Show"}
              </button>
            }
          />
          <CredField label="Port" value={creds.port} onChange={(v) => updateCred("port", v)} placeholder="1433" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input type="checkbox" checked={rememberCreds} onChange={(e) => setRememberCreds(e.target.checked)} className="accent-foreground" />
            Save on this device
          </label>
          <TestConnectionButton status={testStatus} onClick={handleTestConnection} />
        </div>

        <ConnectionStatus status={testStatus} error={testError} />
      </StepCard>

      {/* ── Step 2: Target DB (optional) ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <label className="flex items-center gap-3 cursor-pointer select-none">
            <div className={cn(
              "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
              crossDbMode ? "bg-foreground" : "bg-muted"
            )}>
              <span className={cn(
                "inline-block h-3.5 w-3.5 transform rounded-full bg-background transition-transform shadow-sm",
                crossDbMode ? "translate-x-4" : "translate-x-0.5"
              )} />
              <input
                type="checkbox"
                checked={crossDbMode}
                onChange={(e) => setCrossDbMode(e.target.checked)}
                className="sr-only"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-semibold">Cross-DB Migration</span>
                {crossDbMode && targetConnected && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-medium">Connected</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">Migrate into a different target database</p>
            </div>
          </label>
        </div>

        {crossDbMode && (
          <div className="px-4 pb-4 pt-0 border-t border-border">
            <div className="flex items-center gap-2 mb-3 mt-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Target Database</h3>
              {targetCreds.server && targetCreds.database && (
                <span className="text-xs text-muted-foreground">— {targetCreds.server} / {targetCreds.database}</span>
              )}
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
                  <button type="button" onClick={() => setShowTargetPassword((v) => !v)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {showTargetPassword ? "Hide" : "Show"}
                  </button>
                }
              />
              <CredField label="Port" value={targetCreds.port} onChange={(v) => updateTargetCred("port", v)} placeholder="1433" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-3 border-t border-border">
              <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                <input type="checkbox" checked={rememberTargetCreds} onChange={(e) => setRememberTargetCreds(e.target.checked)} className="accent-foreground" />
                Save on this device
              </label>
              <TestConnectionButton status={targetTestStatus} onClick={handleTestTargetConnection} />
            </div>

            <ConnectionStatus status={targetTestStatus} error={targetTestError} />
          </div>
        )}
      </div>

      {/* ── Step 3: Queries ── */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <StepBadge n={3} />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Queries / Tables / Procedures</h3>
                {queryCount > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {queryCount} {queryCount === 1 ? "entry" : "entries"}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">SELECT queries, bare table names, or stored procedure names</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Upload className="h-3.5 w-3.5" /> Upload Excel / CSV
            </button>
          </div>
        </div>

        <div
          className="[&_.cm-editor]:min-h-[200px]"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); handleFileUpload(e.dataTransfer.files?.[0]); }}
        >
          <CodeMirror
            value={queriesText}
            onChange={(value) => { setQueriesText(value); setGeneratedQueries(null); }}
            theme="none"
            extensions={sqlExtensions}
            placeholder={`cn.tblRedundExcelValidation\nselect * from rp.tblReportConfig where ReportConfigName='Foo'\ncn.spMyStoredProc`}
            basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: true }}
            minHeight="200px"
          />
        </div>

        {uploadError && (
          <div className="flex items-center gap-2 mx-4 mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>{uploadError}</span>
          </div>
        )}

        {/* Options + Generate */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border bg-muted/30">
          <div className="flex flex-wrap items-center gap-4">
            <OptionToggle
              checked={includeDelete}
              onChange={(v) => { setIncludeDelete(v); setGeneratedQueries(null); }}
              label="Include DELETE"
            />
            <OptionToggle
              checked={includeIdentityInsert}
              onChange={(v) => { setIncludeIdentityInsert(v); setGeneratedQueries(null); }}
              label="IDENTITY_INSERT ON/OFF"
            />
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || queryCount === 0 || !credsComplete(creds) || (crossDbMode && !credsComplete(targetCreds))}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {generating ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Generating...</>
            ) : (
              <><Play className="h-4 w-4" /> Generate Script</>
            )}
          </button>
        </div>

        {crossDbMode && !credsComplete(targetCreds) && (
          <div className="flex items-center gap-1.5 px-4 py-2 text-xs text-amber-500 border-t border-border bg-amber-500/5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" /> Fill in all Target Database fields to enable Generate.
          </div>
        )}

        {generateError && (
          <div className="flex items-start gap-2 mx-4 mb-3 mt-1 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{generateError}</span>
          </div>
        )}
      </div>

      {/* ── Generating overlay ── */}
      {generating && <GeneratingOverlay step={generateStep} />}

      {/* ── Generated Script ── */}
      {script && !generating && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <h3 className="text-sm font-semibold">Generated Script</h3>
              {!generatedQueries && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">Stale — re-generate</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors font-medium",
                  copied ? "text-green-500 bg-green-500/10" : "text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors font-medium"
              >
                <Download className="h-3.5 w-3.5" /> Download .sql
              </button>
              {crossDbMode && (
                <button
                  onClick={() => setShowExecuteConfirm(true)}
                  disabled={executing || !generatedQueries}
                  title={!generatedQueries ? "Re-generate first." : undefined}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-colors font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Zap className="h-3.5 w-3.5" /> Execute on Target
                </button>
              )}
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={handleClearScript}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors font-medium"
              >
                <Trash2 className="h-3.5 w-3.5" /> Clear
              </button>
            </div>
          </div>

          <div
            className="[&_.cm-editor]:max-h-[520px] [&_.cm-scroller]:overflow-auto"
            onKeyDown={(e) => {
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

      {/* ── Executing overlay ── */}
      {executing && <GeneratingOverlay step={executeStep} title="Executing on target database" />}

      {/* ── Execute error ── */}
      {executeError && !executing && (
        <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{executeError}</span>
        </div>
      )}

      {/* ── Execute results ── */}
      {executeResults && !executing && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            {executeResults.every((r) => r.ok) ? (
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-500" />
            )}
            <h3 className="text-sm font-semibold">Execution Results</h3>
            <span className="text-xs text-muted-foreground ml-auto">
              {executeResults.filter((r) => r.ok).length}/{executeResults.length} succeeded
            </span>
          </div>
          <div className="divide-y divide-border">
            {executeResults.map((r, i) => (
              <div key={`${r.schema}.${r.table}-${i}`} className={cn(
                "flex items-center gap-3 px-4 py-3 text-xs",
                r.ok ? "bg-green-500/5" : "bg-red-500/5"
              )}>
                {r.ok
                  ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  : <XCircle className="h-4 w-4 text-red-400 shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <span className="font-mono font-medium text-foreground">{r.schema}.{r.table}</span>
                  {r.ok
                    ? <span className="ml-2 text-muted-foreground">{r.rowsAffected} row(s) migrated</span>
                    : <span className="ml-2 text-red-400 truncate">{r.error}</span>
                  }
                </div>
              </div>
            ))}
          </div>
          {executeResults.some((r) => !r.ok) && (
            <div className="px-4 py-3 border-t border-border bg-muted/30 text-xs text-muted-foreground">
              Execution stopped at the first failure. Successful tables above are already committed; tables not listed were never attempted.
            </div>
          )}
        </div>
      )}

      {/* ── Confirm dialog ── */}
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

function StepBadge({ n }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">
      {n}
    </div>
  );
}

function StepCard({ step, title, subtitle, icon, status, open, onToggle, children }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/50 transition-colors text-left"
      >
        <StepBadge n={step} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-sm font-semibold">{title}</span>
            {status === "ok" && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 font-medium">Connected</span>
            )}
            {status === "error" && (
              <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">Error</span>
            )}
          </div>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function TestConnectionButton({ status, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={status === "testing"}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-accent transition-colors disabled:opacity-60"
    >
      {status === "testing" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : status === "ok" ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <PlugZap className="h-3.5 w-3.5" />
      )}
      {status === "testing" ? "Testing..." : "Test Connection"}
    </button>
  );
}

function ConnectionStatus({ status, error }) {
  if (status === "ok") {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-xs text-green-500">
        <CheckCircle2 className="h-3.5 w-3.5" /> Connected successfully.
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5 mt-2 text-xs text-red-400">
        <AlertCircle className="h-3.5 w-3.5" /> {error}
      </div>
    );
  }
  return null;
}

function OptionToggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none hover:text-foreground transition-colors">
      <div className={cn(
        "relative inline-flex h-4 w-7 items-center rounded-full transition-colors shrink-0",
        checked ? "bg-foreground" : "bg-muted"
      )}>
        <span className={cn(
          "inline-block h-3 w-3 transform rounded-full bg-background transition-transform shadow-sm",
          checked ? "translate-x-3.5" : "translate-x-0.5"
        )} />
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only" />
      </div>
      {label}
    </label>
  );
}

function ExecuteConfirmDialog({ tableCount, targetLabel, onCancel, onConfirm }) {
  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm px-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div role="dialog" aria-modal="true" className="w-full max-w-sm rounded-xl border border-border bg-card shadow-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-500/10">
            <Zap className="h-4 w-4 text-red-400" />
          </div>
          <h3 className="text-sm font-semibold">Execute on target?</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          This will run DELETE/INSERT statements for <strong className="text-foreground">{tableCount} {tableCount === 1 ? "table" : "tables"}</strong> directly against{" "}
          <strong className="text-foreground">{targetLabel}</strong>. Each table runs in its own transaction and rolls back on failure — but this is a real write.
        </p>
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-red-500 text-white hover:bg-red-600 transition-colors">
            Yes, execute
          </button>
        </div>
      </div>
    </div>
  );
}

function GeneratingOverlay({ step, title = "Generating migration script" }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-card p-10 flex flex-col items-center justify-center gap-5">
      <div className="migration-liquid-loader">
        <span /><span /><span />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-muted-foreground transition-all duration-300">{GENERATE_STEPS[step]}</span>
      </div>
    </div>
  );
}

function CredField({ label, value, onChange, placeholder, type = "text", toggle }) {
  return (
    <label className="flex flex-col gap-1.5">
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
        className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring/40 transition-colors"
      />
    </label>
  );
}
