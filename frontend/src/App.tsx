import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import {
  BookOpen,
  Calendar,
  FileText,
  Home,
  Layers,
  LogOut,
  MessageCircle,
  Timer as TimerIcon,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "./lib/auth/AuthContext";
import { ProfileModal } from "./features/auth/components/ProfileModal";

const navMain = [
  { to: "/dashboard", label: "Início", icon: Home },
  { to: "/timer", label: "Cronômetro", icon: TimerIcon },
  { to: "/documents", label: "Documentos", icon: FileText },
  { to: "/quiz", label: "Quizzes", icon: HelpCircle },
  { to: "/study-plan", label: "Plano de estudos", icon: Calendar },
  { to: "/notebooks", label: "Cadernos", icon: BookOpen },
  { to: "/chat", label: "Tirar dúvida", icon: MessageCircle },
];

const navOrg = [
  { to: "/subjects", label: "Matérias", icon: Layers },
];

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function App() {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const displayName = user?.name ?? "Visitante";
  const displayEmail = user?.email ?? "";
  const initials = initialsOf(displayName);

  return (
    <div className="min-h-full flex bg-ink-950 text-ink-200">
      <aside className="w-64 shrink-0 border-r border-ink-700 bg-ink-900 flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <span className="text-white text-sm font-bold">T</span>
          </div>
          <span className="text-ink-100 font-semibold">Tempus</span>
        </div>

        <nav className="px-3 py-2 flex-1 overflow-y-auto">
          <p className="label-section px-3 mb-2">Navegação</p>
          <ul className="space-y-0.5 mb-6">
            {navMain.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                      isActive
                        ? "bg-brand-500/10 text-ink-100 border border-brand-500/30"
                        : "text-ink-300 hover:bg-ink-800 border border-transparent"
                    }`
                  }
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1">{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>

          <p className="label-section px-3 mb-2">Organização</p>
          <ul className="space-y-0.5">
            {navOrg.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
                      isActive
                        ? "bg-brand-500/10 text-ink-100"
                        : "text-ink-300 hover:bg-ink-800"
                    }`
                  }
                >
                  <Icon size={16} className="shrink-0" />
                  <span>{label}</span>
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="px-3 pb-3 space-y-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <button
              type="button"
              onClick={() => setProfileOpen(true)}
              className="flex items-center gap-3 flex-1 min-w-0 text-left rounded-lg hover:bg-ink-800 px-1 -mx-1 py-1 transition"
              title="Editar perfil"
            >
              <div className="w-9 h-9 rounded-full bg-brand-500/20 text-brand-300 flex items-center justify-center text-xs font-semibold border border-brand-500/30 shrink-0">
                {initials || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-ink-100 truncate">{displayName}</p>
                {displayEmail && (
                  <p className="text-xs text-ink-500 truncate">{displayEmail}</p>
                )}
              </div>
            </button>
            <button
              onClick={logout}
              className="text-ink-500 hover:text-ink-200 transition shrink-0"
              title="Sair"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-8 py-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
