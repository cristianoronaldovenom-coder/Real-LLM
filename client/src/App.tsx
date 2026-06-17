import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation } from "react-router-dom";
import { MessageSquare, BookOpen, Brain, Settings, BarChart2, GraduationCap, UserCircle, Loader2 } from "lucide-react";
import { cn } from "./lib/utils";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import ChatPage from "./pages/ChatPage";
import KnowledgePage from "./pages/KnowledgePage";
import MemoryPage from "./pages/MemoryPage";
import SettingsPage from "./pages/SettingsPage";
import ModelsPage from "./pages/ModelsPage";
import TrainingPage from "./pages/TrainingPage";
import AccountPage from "./pages/AccountPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

const navItems = [
  { to: "/", icon: MessageSquare, label: "Chat" },
  { to: "/knowledge", icon: BookOpen, label: "Knowledge" },
  { to: "/memory", icon: Brain, label: "Memory" },
  { to: "/models", icon: BarChart2, label: "Models" },
  { to: "/training", icon: GraduationCap, label: "Fine-tune" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

function AppShell() {
  const { user } = useAuth();
  return (
    <div className="flex h-full bg-[hsl(var(--background))]">
      {/* Sidebar */}
      <nav className="w-16 flex flex-col items-center py-4 gap-1 border-r border-[hsl(var(--border))] bg-[hsl(var(--card))] shrink-0">
        <div className="w-9 h-9 rounded-xl bg-[hsl(var(--primary))] flex items-center justify-center mb-4 shrink-0">
          <span className="text-[hsl(var(--primary-foreground))] font-bold text-sm">AI</span>
        </div>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            title={label}
            className={({ isActive }) =>
              cn(
                "w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
                isActive
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
              )
            }
          >
            <Icon className="w-5 h-5" />
          </NavLink>
        ))}

        {/* Account (bottom) */}
        <NavLink
          to="/account"
          title={user?.displayName || user?.username || "Account"}
          className={({ isActive }) =>
            cn(
              "mt-auto w-10 h-10 rounded-lg flex items-center justify-center transition-colors",
              isActive
                ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]"
            )
          }
        >
          <UserCircle className="w-5 h-5" />
        </NavLink>
      </nav>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-hidden flex flex-col">
        <Routes>
          <Route path="/" element={<ChatPage />} />
          <Route path="/knowledge" element={<KnowledgePage />} />
          <Route path="/memory" element={<MemoryPage />} />
          <Route path="/models" element={<ModelsPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[hsl(var(--background))]">
        <Loader2 className="w-6 h-6 animate-spin text-[hsl(var(--muted-foreground))]" />
      </div>
    );
  }

  if (!user) {
    // Unauthenticated: only login / signup are reachable.
    if (location.pathname === "/signup") return <SignupPage />;
    if (location.pathname === "/login") return <LoginPage />;
    return <Navigate to="/login" replace />;
  }

  // Authenticated: bounce away from auth screens into the app.
  if (location.pathname === "/login" || location.pathname === "/signup") {
    return <Navigate to="/" replace />;
  }

  return <AppShell />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  );
}
