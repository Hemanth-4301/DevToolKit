import { useState, useEffect, useCallback } from "react";
import { LogOut, Settings, Link2, HardDrive, TrendingUp, Gauge, RefreshCw, Loader2 } from "lucide-react";
import { adminListShares, adminDeleteShare } from "../lib/adminApi";
import { addToast } from "../components/Toast";
import StatTile from "../components/admin/StatTile";
import LinksOverTimeChart from "../components/admin/LinksOverTimeChart";
import SizeDistributionChart from "../components/admin/SizeDistributionChart";
import SharesTable from "../components/admin/SharesTable";
import AdminSettingsPanel from "../components/admin/AdminSettingsPanel";

function formatSize(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(1)} KB`;
  return `${(bytes / 1_000_000).toFixed(2)} MB`;
}

export default function AdminDashboard({ auth }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await adminListShares();
      setData(result);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const handleDelete = async (id) => {
    try {
      await adminDeleteShare(id);
      addToast({ title: `Deleted /${id}`, type: "success" });
      load(true);
    } catch (err) {
      addToast({ title: err.message || "Delete failed.", type: "error" });
    }
  };

  return (
    <div className="admin-dash-bg min-h-[calc(100vh-57px)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight admin-dash-title">Admin Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Signed in as <span className="font-medium text-foreground">{auth.username}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-60"
              title="Refresh"
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Settings className="h-4 w-4" /> Settings
            </button>
            <button
              onClick={auth.logout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </div>
        </header>

        {showSettings && (
          <AdminSettingsPanel
            onClose={() => setShowSettings(false)}
            onUpdated={() => auth.refresh()}
          />
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatTile label="Total Links" value={data.stats.totalLinks} icon={Link2} accent />
              <StatTile label="Avg Size" value={formatSize(data.stats.avgSize)} icon={HardDrive} />
              <StatTile label="Largest Snippet" value={formatSize(data.stats.maxSize)} icon={Gauge} />
              <StatTile
                label="Created Today"
                value={data.stats.linksPerDay.at(-1)?.count ?? 0}
                icon={TrendingUp}
                accent
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-card-border bg-card p-5">
                <h2 className="text-sm font-semibold text-card-foreground mb-4">
                  Links Created — Last 30 Days
                </h2>
                <LinksOverTimeChart data={data.stats.linksPerDay} />
              </div>
              <div className="rounded-2xl border border-card-border bg-card p-5">
                <h2 className="text-sm font-semibold text-card-foreground mb-4">
                  Snippet Size Distribution
                </h2>
                <SizeDistributionChart data={data.stats.sizeDistribution} />
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-card-foreground mb-3">All Links</h2>
              <SharesTable shares={data.shares} onDelete={handleDelete} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
