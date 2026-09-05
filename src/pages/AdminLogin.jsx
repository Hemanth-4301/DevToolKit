import { useState, useRef } from "react";
import { Shield, Lock, User, Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { cn } from "../lib/utils";

export default function AdminLogin({ auth }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const cardRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await auth.login(username, password);
    } catch (err) {
      setError(err.message || "Invalid username or password.");
      setShake(true);
      setTimeout(() => setShake(false), 400);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMouseMove = (e) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 8;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -8;
    card.style.setProperty("--tiltX", `${y}deg`);
    card.style.setProperty("--tiltY", `${x}deg`);
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--tiltX", "0deg");
    card.style.setProperty("--tiltY", "0deg");
  };

  return (
    <div className="admin-login-bg relative flex items-center justify-center min-h-[calc(100vh-57px)] overflow-hidden px-4 py-12">
      <div className="admin-login-orb admin-login-orb-1" />
      <div className="admin-login-orb admin-login-orb-2" />
      <div className="admin-login-orb admin-login-orb-3" />
      <div className="admin-login-grid" />

      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className={cn("admin-login-card-wrap relative w-full max-w-sm", shake && "admin-login-shake")}
      >
        <div className="admin-login-card-border" />
        <div className="admin-login-card relative rounded-2xl bg-card/90 backdrop-blur-xl shadow-2xl p-8">
          <div className="flex flex-col items-center gap-3 mb-8">
            <div className="admin-login-icon flex items-center justify-center h-14 w-14 rounded-2xl">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-card-foreground">Admin Access</h1>
            <p className="text-xs text-muted-foreground text-center">
              Restricted area — sign in to manage Code Share
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <User className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
            </div>

            <div className="relative">
              <Lock className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-9 py-2.5 text-sm rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="admin-login-submit relative mt-2 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold text-primary-foreground disabled:opacity-60 disabled:cursor-not-allowed overflow-hidden"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
