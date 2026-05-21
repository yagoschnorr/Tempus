import { FormEvent, useEffect, useState } from "react";
import { AlertTriangle, Lock, Mail, Trash2, User as UserIcon } from "lucide-react";
import { Button } from "@/components/Button";
import { Input } from "@/components/Input";
import { Modal } from "@/components/Modal";
import { getErrorMessage } from "@/lib/api/client";
import { useAuth } from "@/lib/auth/AuthContext";
import { authApi } from "../api";

type Tab = "profile" | "password" | "danger";

interface Props {
  open: boolean;
  onClose: () => void;
}

const TIMEZONES = [
  "America/Belem",
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Rio_Branco",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Cuiaba",
  "America/Noronha",
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Lisbon",
  "Europe/Berlin",
];

const TABS: { id: Tab; label: string; icon: typeof UserIcon }[] = [
  { id: "profile", label: "Perfil", icon: UserIcon },
  { id: "password", label: "Senha", icon: Lock },
  { id: "danger", label: "Excluir conta", icon: Trash2 },
];

export function ProfileModal({ open, onClose }: Props) {
  const [tab, setTab] = useState<Tab>("profile");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(
    null
  );

  useEffect(() => {
    if (open) {
      setTab("profile");
      setFeedback(null);
    }
  }, [open]);

  useEffect(() => {
    if (!feedback) return;
    const t = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(t);
  }, [feedback]);

  return (
    <Modal open={open} onClose={onClose} title="Minha conta">
      <div className="space-y-4">
        <nav className="flex gap-1 p-1 rounded-lg bg-ink-900 border border-ink-700">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            const isDanger = id === "danger";
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setTab(id);
                  setFeedback(null);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  active
                    ? isDanger
                      ? "bg-danger-500/15 text-danger-500 border border-danger-500/30"
                      : "bg-brand-500/15 text-brand-300 border border-brand-500/30"
                    : "text-ink-400 hover:text-ink-100"
                }`}
              >
                <Icon size={13} />
                {label}
              </button>
            );
          })}
        </nav>

        {feedback && (
          <p
            className={`text-sm rounded-lg border px-3 py-2 ${
              feedback.kind === "success"
                ? "text-success-400 bg-success-500/10 border-success-500/30"
                : "text-danger-500 bg-danger-500/10 border-danger-500/30"
            }`}
          >
            {feedback.message}
          </p>
        )}

        {tab === "profile" && (
          <ProfileTab onSuccess={(m) => setFeedback({ kind: "success", message: m })} />
        )}
        {tab === "password" && (
          <PasswordTab onSuccess={(m) => setFeedback({ kind: "success", message: m })} />
        )}
        {tab === "danger" && <DangerTab onClose={onClose} />}
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Perfil — nome + timezone
// ---------------------------------------------------------------------------
function ProfileTab({ onSuccess }: { onSuccess: (message: string) => void }) {
  const { user, updateUser } = useAuth();
  const [name, setName] = useState(user?.name ?? "");
  const [timezone, setTimezone] = useState(user?.timezone ?? "America/Belem");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(user?.name ?? "");
    setTimezone(user?.timezone ?? "America/Belem");
  }, [user]);

  const dirty =
    name.trim() !== (user?.name ?? "") || timezone !== (user?.timezone ?? "America/Belem");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nome é obrigatório");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const updated = await authApi.updateProfile({
        name: name.trim(),
        timezone,
      });
      updateUser({ name: updated.name, timezone: updated.timezone });
      onSuccess("Perfil atualizado");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível salvar o perfil"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Nome"
        name="profile-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        autoComplete="name"
        required
      />

      <EmailChangeSection
        currentEmail={user?.email ?? ""}
        onSuccess={(m) => onSuccess(m)}
      />

      <label className="block text-sm">
        <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
          Fuso horário
        </span>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          className="w-full rounded-lg bg-ink-900 border border-ink-700 px-3 py-2.5 text-ink-100 focus:border-brand-500 focus:outline-none"
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={submitting || !dirty}>
          {submitting ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Trocar email — pede confirmação no novo endereço antes de aplicar
// ---------------------------------------------------------------------------
function EmailChangeSection({
  currentEmail,
  onSuccess,
}: {
  currentEmail: string;
  onSuccess: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setOpen(false);
    setNewEmail("");
    setPassword("");
    setError(null);
  }

  // Sem <form>: este bloco vive dentro do form do ProfileTab. Form aninhado
  // é inválido em HTML — o browser ignora o inner e qualquer "submit" cai no
  // form externo, salvando o perfil em vez de pedir a troca de email.
  async function handleSend() {
    const target = newEmail.trim().toLowerCase();
    if (!target) {
      setError("Informe o novo email");
      return;
    }
    if (target === currentEmail.toLowerCase()) {
      setError("O novo email precisa ser diferente do atual");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApi.requestEmailChange({
        new_email: target,
        current_password: password,
      });
      onSuccess(`Enviamos um link de confirmação para ${target}. Expira em 1 hora.`);
      close();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível enviar o email de verificação"));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEnterKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault(); // impede o submit do form externo
      void handleSend();
    }
  }

  return (
    <div>
      <span className="block mb-1.5 text-ink-300 font-medium text-xs uppercase tracking-wider">
        Email
      </span>
      <div className="w-full rounded-lg bg-ink-900/50 border border-ink-700 px-3 py-2.5 text-ink-400 text-sm">
        {currentEmail || "—"}
      </div>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 font-medium"
        >
          <Mail size={12} /> Trocar email
        </button>
      ) : (
        <div className="mt-3 space-y-3 rounded-lg border border-ink-700 bg-ink-900/40 p-3">
          <Input
            label="Novo email"
            name="new-email"
            type="email"
            autoComplete="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={handleEnterKey}
            required
          />
          <Input
            label="Senha atual"
            name="email-change-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleEnterKey}
            required
          />
          <p className="text-xs text-ink-500">
            Mandaremos um link para o novo endereço. Depois de confirmar, você precisará
            entrar de novo com o email atualizado.
          </p>

          {error && (
            <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSend}
              disabled={submitting || !newEmail || !password}
            >
              {submitting ? "Enviando..." : "Enviar verificação"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Senha — current + new + confirm
// ---------------------------------------------------------------------------
function PasswordTab({ onSuccess }: { onSuccess: (message: string) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next.length < 8) {
      setError("A nova senha deve ter ao menos 8 caracteres");
      return;
    }
    if (next !== confirm) {
      setError("A confirmação não bate com a nova senha");
      return;
    }
    if (next === current) {
      setError("A nova senha precisa ser diferente da atual");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await authApi.changePassword({ current_password: current, new_password: next });
      reset();
      onSuccess("Senha alterada");
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível alterar a senha"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Senha atual"
        name="current-password"
        type="password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        required
      />
      <Input
        label="Nova senha"
        name="new-password"
        type="password"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        hint="Mínimo 8 caracteres."
        required
      />
      <Input
        label="Confirmar nova senha"
        name="confirm-password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        required
      />

      {error && (
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={submitting || !current || !next || !confirm}>
          {submitting ? "Alterando..." : "Alterar senha"}
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Danger zone — exclusão da conta com dupla confirmação
// ---------------------------------------------------------------------------
const DELETE_CONFIRMATION_TEXT = "EXCLUIR";

function DangerTab({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    password.length > 0 &&
    acknowledged &&
    confirmation.trim().toUpperCase() === DELETE_CONFIRMATION_TEXT;

  async function handleDelete(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setSubmitting(true);
    setError(null);
    try {
      await authApi.deleteAccount({ password });
      // Sucesso → fecha o modal, limpa auth (RequireAuth manda pra /login)
      onClose();
      logout();
    } catch (err) {
      setError(getErrorMessage(err, "Não foi possível excluir a conta"));
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleDelete} className="space-y-4">
      <div className="rounded-lg border border-danger-500/30 bg-danger-500/5 p-4 space-y-2">
        <p className="font-medium text-danger-500 flex items-center gap-2 text-sm">
          <AlertTriangle size={14} /> Esta ação é permanente
        </p>
        <p className="text-sm text-ink-300">
          Apagar a conta <span className="text-ink-100 font-medium">{user?.email}</span>{" "}
          remove em definitivo suas matérias, sessões, quizzes, documentos e cadernos.
          Não há como recuperar depois.
        </p>
      </div>

      <Input
        label="Confirme sua senha"
        name="delete-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      <Input
        label={`Digite "${DELETE_CONFIRMATION_TEXT}" para confirmar`}
        name="delete-confirmation"
        value={confirmation}
        onChange={(e) => setConfirmation(e.target.value)}
        placeholder={DELETE_CONFIRMATION_TEXT}
        required
      />

      <label className="flex items-start gap-2 text-sm text-ink-300 cursor-pointer">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(e) => setAcknowledged(e.target.checked)}
          className="mt-1 accent-danger-500"
        />
        <span>Entendo que esta ação é permanente e não pode ser desfeita.</span>
      </label>

      {error && (
        <p className="text-sm text-danger-500 bg-danger-500/10 border border-danger-500/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
          Cancelar
        </Button>
        <Button type="submit" variant="danger" disabled={!ready || submitting}>
          {submitting ? "Excluindo..." : "Excluir minha conta"}
        </Button>
      </div>
    </form>
  );
}
