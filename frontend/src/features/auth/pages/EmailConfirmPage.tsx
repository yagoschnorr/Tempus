import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, MailX, Loader2 } from "lucide-react";
import { Button } from "@/components/Button";
import { getErrorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { authApi } from "../api";

type Status = "loading" | "success" | "error" | "missing-token";

export default function EmailConfirmPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const token = params.get("token");

  const [status, setStatus] = useState<Status>(token ? "loading" : "missing-token");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // Evita double-call do StrictMode em dev (o segundo POST cairia em 400 "já usado")
  const calledRef = useRef(false);

  useEffect(() => {
    if (!token || calledRef.current) return;
    calledRef.current = true;

    (async () => {
      try {
        await authApi.confirmEmailChange({ token });
        // Sucesso: força logout (decisão de design) e manda pro login com mensagem.
        logout();
        setStatus("success");
        setTimeout(() => {
          navigate("/login", {
            replace: true,
            state: {
              notice:
                "Email alterado com sucesso. Entre novamente usando o novo endereço.",
            },
          });
        }, 1500);
      } catch (err) {
        setErrorMsg(getErrorMessage(err, "Link inválido ou expirado"));
        setStatus("error");
      }
    })();
  }, [token, logout, navigate]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-ink-950 p-6">
      <div className="w-full max-w-sm card p-8 space-y-4 text-center">
        {status === "loading" && (
          <>
            <Loader2 size={32} className="mx-auto animate-spin text-brand-400" />
            <h1 className="text-lg font-semibold text-ink-100">Confirmando…</h1>
            <p className="text-sm text-ink-400">
              Validando seu link de troca de email. Aguarde um instante.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle2 size={32} className="mx-auto text-success-400" />
            <h1 className="text-lg font-semibold text-ink-100">Email alterado!</h1>
            <p className="text-sm text-ink-400">
              Redirecionando pra tela de login…
            </p>
          </>
        )}

        {status === "missing-token" && (
          <>
            <MailX size={32} className="mx-auto text-danger-500" />
            <h1 className="text-lg font-semibold text-ink-100">Link inválido</h1>
            <p className="text-sm text-ink-400">
              O link de confirmação não veio com o token necessário. Pede a troca
              novamente nas configurações da conta.
            </p>
            <Link to="/login">
              <Button variant="ghost" className="w-full mt-2">
                Ir pro login
              </Button>
            </Link>
          </>
        )}

        {status === "error" && (
          <>
            <MailX size={32} className="mx-auto text-danger-500" />
            <h1 className="text-lg font-semibold text-ink-100">
              Não foi possível confirmar
            </h1>
            <p className="text-sm text-ink-400">{errorMsg}</p>
            <Link to="/login">
              <Button variant="ghost" className="w-full mt-2">
                Ir pro login
              </Button>
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
