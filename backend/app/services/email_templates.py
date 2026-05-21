"""Templates de email transacional.

Cada template é uma função que retorna `(subject, html, text)`. Mantemos
strings simples (sem Jinja) enquanto o volume de templates é baixo. O
`_wrap_html` adiciona header/footer comum pra evitar duplicação.
"""
from __future__ import annotations

from html import escape


def _wrap_html(body: str) -> str:
    """Envolve o conteúdo do template no chrome padrão da Tempus."""
    return f"""\
<!DOCTYPE html>
<html lang="pt-br">
  <head><meta charset="utf-8"></head>
  <body style="margin:0;padding:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0b0d12;color:#e6e8ee;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b0d12;padding:32px 0;">
      <tr><td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#11141b;border:1px solid #2a2f3d;border-radius:12px;padding:32px;">
          <tr><td style="padding-bottom:24px;border-bottom:1px solid #2a2f3d;">
            <span style="font-size:18px;font-weight:600;color:#a5b3ff;">Tempus</span>
          </td></tr>
          <tr><td style="padding-top:24px;font-size:14px;line-height:1.6;color:#cdd2dc;">
            {body}
          </td></tr>
          <tr><td style="padding-top:24px;margin-top:24px;border-top:1px solid #2a2f3d;font-size:12px;color:#6b7385;">
            Você recebeu este email porque uma ação foi solicitada na sua conta Tempus. Se não foi você, pode ignorar com segurança.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>"""


def email_change_verification(
    *, name: str, new_email: str, confirm_url: str
) -> tuple[str, str, str]:
    """Email enviado pro novo endereço quando o usuário pede troca."""
    subject = "Confirme seu novo email — Tempus"
    safe_name = escape(name)
    safe_email = escape(new_email)
    safe_url = escape(confirm_url, quote=True)

    body = f"""\
<p style="margin:0 0 16px;">Olá, {safe_name}!</p>
<p style="margin:0 0 16px;">
  Recebemos um pedido pra trocar o email da sua conta Tempus para
  <strong style="color:#a5b3ff;">{safe_email}</strong>.
</p>
<p style="margin:0 0 24px;">
  Clique no botão abaixo pra confirmar a alteração. O link expira em 1 hora.
</p>
<p style="margin:0 0 24px;">
  <a href="{safe_url}"
     style="display:inline-block;background:#534AB7;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">
    Confirmar novo email
  </a>
</p>
<p style="margin:0;font-size:13px;color:#9aa3b5;">
  Se o botão não funcionar, copie e cole este endereço no navegador:<br>
  <span style="color:#cdd2dc;word-break:break-all;">{safe_url}</span>
</p>"""

    text = f"""Olá, {name}!

Recebemos um pedido pra trocar o email da sua conta Tempus para {new_email}.

Abra o link abaixo pra confirmar (expira em 1 hora):

{confirm_url}

Se não foi você, pode ignorar este email — a troca não vai acontecer sem a confirmação.
"""

    return subject, _wrap_html(body), text
