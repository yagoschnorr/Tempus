import { FormEvent, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Timer, HelpCircle, LineChart } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { api } from "@/lib/api/client";
import type { AuthResponse } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthContext";

function passwordStrength(pwd: string): { score: number; label: string; color: string } {
  let s = 0;
  if (pwd.length >= 8) s++;
  if (/[A-Z]/.test(pwd)) s++;
  if (/[0-9]/.test(pwd)) s++;
  if (/[^A-Za-z0-9]/.test(pwd)) s++;
  const labels = ["Fraca", "Razoável", "Boa", "Forte"];
  const colors = ["bg-danger-500", "bg-warning-500", "bg-brand-400", "bg-success-500"];
  return { score: s, label: labels[Math.max(0, s - 1)] ?? "Fraca", color: colors[Math.max(0, s - 1)] ?? "bg-ink-700" };
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accept, setAccept] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Senhas não conferem");
      return;
    }
    if (!accept) {
      setError("Você precisa aceitar os termos");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api<AuthResponse>("/auth/register", {
        method: "POST",
        json: { name, email, password },
      });
      login(res.user, res.access_token);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError("Não foi possível criar conta");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      <aside className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-ink-900 via-ink-900 to-brand-900/40 border-r border-ink-700">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
            <span className="text-white text-sm font-bold">T</span>
          </div>
          <span className="text-ink-100 font-semibold">Tempus</span>
        </div>

        <div className="max-w-md space-y-5">
          <span className="pill bg-brand-500/15 text-brand-300 border border-brand-500/20">
            Grátis durante a beta
          </span>
          <h1 className="text-4xl font-bold text-ink-100 leading-tight">
            Crie sua conta no Tempus.
          </h1>
          <p className="text-ink-400 leading-relaxed">
            Em menos de 1 minuto você já tem cronômetro, IA e dashboard prontos para a próxima
            prova.
          </p>
          <ul className="space-y-2 text-sm text-ink-300">
            <li className="flex items-center gap-2">
              <Timer size={14} className="text-brand-400" /> Cronômetro
            </li>
            <li className="flex items-center gap-2">
              <HelpCircle size={14} className="text-brand-400" /> Quizzes c/ IA
            </li>
            <li className="flex items-center gap-2">
              <LineChart size={14} className="text-brand-400" /> Dashboard
            </li>
          </ul>
        </div>

        <p className="text-xs text-ink-500">© 2026 Tempus · Estude com método.</p>
      </aside>

      <main className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-brand-400 font-semibold">
              Criar conta
            </p>
            <h2 className="text-2xl font-semibold text-ink-100">Bem-vinda ao Tempus</h2>
            <p className="text-sm text-ink-400">
              Já tem conta?{" "}
              <Link to="/login" className="text-brand-400 hover:text-brand-300 font-medium">
                Entrar
              </Link>
            </p>
          </header>

          <Input
            label="Nome completo"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Email"
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Senha"
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1 h-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-full ${i < strength.score ? strength.color : "bg-ink-800"}`}
                  />
                ))}
              </div>
              <p className="text-xs text-ink-400">
                Força da senha: <span className="text-ink-200 font-medium">{strength.label}</span>
              </p>
            </div>
          )}
          <Input
            label="Confirmar senha"
            type="password"
            name="confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />

          <label className="flex items-start gap-2 text-sm text-ink-300">
            <input
              type="checkbox"
              checked={accept}
              onChange={(e) => setAccept(e.target.checked)}
              className="mt-0.5 rounded border-ink-700 bg-ink-900 text-brand-500 focus:ring-brand-500"
            />
            <span className="text-xs">
              Concordo com os{" "}
              <a href="#" className="text-brand-400 hover:underline">Termos</a> e a{" "}
              <a href="#" className="text-brand-400 hover:underline">
                Política de Privacidade
              </a>{" "}
              do Tempus.
            </span>
          </label>

          {error && (
            <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? (
              "Criando..."
            ) : (
              <>
                <CheckCircle2 size={16} /> Criar minha conta
              </>
            )}
          </Button>
        </form>
      </main>
    </div>
  );
}
