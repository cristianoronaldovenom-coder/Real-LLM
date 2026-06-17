import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { UserCircle, LogOut, Save, KeyRound, Loader2 } from "lucide-react";
import { api } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";

export default function AccountPage() {
  const { user, logout, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSaved, setPwSaved] = useState(false);

  const profileMutation = useMutation({
    mutationFn: (name: string) => api.updateProfile(name),
    onSuccess: ({ user }) => {
      setUser(user);
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    },
  });

  const passwordMutation = useMutation({
    mutationFn: () => api.changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwError(null);
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    },
    onError: (err) => setPwError(err instanceof Error ? err.message : "Could not change password"),
  });

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPwError(null);
    if (newPassword !== confirmPassword) {
      setPwError("New passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      setPwError("New password must be at least 6 characters");
      return;
    }
    passwordMutation.mutate();
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-[hsl(var(--border))]">
        <h1 className="text-xl font-semibold">Account</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6 max-w-2xl">
        {/* Profile summary */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-3 mb-1">
            <UserCircle className="w-10 h-10 text-[hsl(var(--primary))]" />
            <div>
              <div className="font-medium">{user?.displayName || user?.username}</div>
              <div className="text-sm text-[hsl(var(--muted-foreground))]">@{user?.username}</div>
            </div>
          </div>
        </div>

        {/* Display name */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <h2 className="font-medium mb-1">Display name</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">The name shown in the app. Your username can't be changed.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="flex-1 px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
            />
            <button
              onClick={() => profileMutation.mutate(displayName.trim())}
              disabled={profileMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {profileSaved ? "Saved ✓" : profileMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {!profileSaved && !profileMutation.isPending && "Save"}
            </button>
          </div>
        </div>

        {/* Change password */}
        <form onSubmit={handlePasswordSubmit} className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound className="w-4 h-4 text-[hsl(var(--primary))]" />
            <h2 className="font-medium">Change password</h2>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">Pick something at least 6 characters long.</p>

          {pwError && (
            <div className="text-sm text-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 border border-[hsl(var(--destructive))]/30 rounded-lg px-3 py-2 mb-3">
              {pwError}
            </div>
          )}

          <div className="space-y-3">
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Current password"
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="New password"
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              className="w-full px-3 py-2 text-sm border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] outline-none focus:ring-2 focus:ring-[hsl(var(--ring))]"
              required
            />
          </div>

          <button
            type="submit"
            disabled={passwordMutation.isPending || !currentPassword || !newPassword || !confirmPassword}
            className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {pwSaved ? "Password updated ✓" : passwordMutation.isPending ? "Updating…" : "Update password"}
          </button>
        </form>

        {/* Log out */}
        <div className="border border-[hsl(var(--border))] rounded-xl p-5 bg-[hsl(var(--card))]">
          <h2 className="font-medium mb-1">Log out</h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mb-4">You'll need your username and password to log back in.</p>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 px-4 py-2 text-[hsl(var(--destructive))] border border-[hsl(var(--destructive))]/30 text-sm rounded-lg hover:bg-[hsl(var(--destructive))]/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
