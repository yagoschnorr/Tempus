import { FormEvent, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Github, ShieldCheck } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { getErrorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { authApi } from "../api";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = (location.state as { from?: Location })?.from?.pathname ?? "/dashboard";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.login(email, password);
      login(res.user, res.access_token);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, "Credenciais inválidas"));
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

        <div className="max-w-md space-y-4">
          <h1 className="text-4xl font-bold text-ink-100 leading-tight">
            Bem-vinda de volta
          </h1>
          <p className="text-xl text-ink-300">Entre na sua rotina.</p>
          <p className="text-ink-400 leading-relaxed">
            Continue de onde parou: <span className="text-ink-100">3 sessões pendentes</span>{" "}
            hoje e um quiz novo no{" "}
            <span className="text-brand-300 font-medium">Cálculo 2</span>.
          </p>
        </div>

        <p className="text-xs text-ink-500">
          © 2026 Tempus · Estude com método.
        </p>
      </aside>

      <main className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <header className="space-y-1">
            <p className="text-xs uppercase tracking-wider text-brand-400 font-semibold">
              Entrar no Tempus
            </p>
            <h2 className="text-2xl font-semibold text-ink-100">Bem-vinda de volta</h2>
            <p className="text-sm text-ink-400">
              Ainda não tem conta?{" "}
              <Link to="/register" className="text-brand-400 hover:text-brand-300 font-medium">
                Criar conta
              </Link>
            </p>
          </header>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-ink-900 border border-ink-700 text-ink-200 text-sm hover:bg-ink-800 transition"
            >
              <span className="text-base">G</span> Google
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 py-2.5 rounded-lg bg-ink-900 border border-ink-700 text-ink-200 text-sm hover:bg-ink-800 transition"
            >
              <Github size={14} /> GitHub
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-ink-500">
            <div className="h-px flex-1 bg-ink-700" />
            <span>ou com email</span>
            <div className="h-px flex-1 bg-ink-700" />
          </div>

          <Input
            label="Email"
            type="email"
            name="email"
            placeholder="seu_email@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="space-y-1">
            <Input
              label="Senha"
              type="password"
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="flex justify-end">
              <a href="#" className="text-xs text-ink-400 hover:text-ink-200">
                Esqueci minha senha
              </a>
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-300">
            <input
              type="checkbox"
              className="rounded border-ink-700 bg-ink-900 text-brand-500 focus:ring-brand-500"
            />
            Manter conectada por 30 dias
          </label>

          {error && (
            <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "Entrando..." : "Entrar no Tempus"}
          </Button>

          <p className="flex items-center justify-center gap-2 text-xs text-ink-500">
            <ShieldCheck size={12} />
            Login criptografado · 2FA opcional · Seus dados não treinam modelos públicos.
          </p>
        </form>
      </main>
    </div>
  );
}
