import { useState } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { adminChangePassword } from "../../lib/adminApi";
import { addToast } from "../../components/Toast";

export default function AdminSettingsPanel({ onClose, onUpdated }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminChangePassword({
        currentPassword,
        newPassword,
        newUsername: newUsername.trim() || undefined,
      });
      addToast({ title: "Admin credentials updated.", type: "success" });
      onUpdated?.(result.username);
      onClose?.();
    } catch (err) {
      setError(err.message || "Failed to update credentials.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl border border-card-border bg-card p-5 sm:p-6">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Change Credentials</h3>

      {error && (
        <div className="flex items-start gap-2 mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <Field label="Current password">
          <input
            type="password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="admin-settings-input"
          />
        </Field>
        <Field label="New password (min 8 characters)">
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="admin-settings-input"
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="admin-settings-input"
          />
        </Field>
        <Field label="New username (optional)">
          <input
            type="text"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            placeholder="Leave blank to keep current"
            className="admin-settings-input"
          />
        </Field>

        <div className="flex items-center gap-2 mt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save Changes
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
