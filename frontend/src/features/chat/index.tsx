import { FileText, Send, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/Button";

interface Message {
  role: "user" | "assistant";
  text: string;
  sources?: { document: string; page: number; snippet: string }[];
}

const initialMessages: Message[] = [
  {
    role: "user",
    text: "Por que o Jacobiano aparece quando trocamos de variáveis numa integral tripla?",
  },
  {
    role: "assistant",
    text: "O Jacobiano corrige a distorção de volume entre os dois sistemas de coordenadas. Quando você substitui (x, y, z) por (u, v, w) via uma transformação T, cada pequeno cubo no espaço (u, v, w) é mapeado para um paralelepípedo no espaço (x, y, z) — o |det J| mede o fator de expansão/contração desse volume.",
    sources: [
      {
        document: "Integrais Triplas — Notas de aula.pdf",
        page: 14,
        snippet:
          "O determinante da matriz Jacobiana mede a razão entre os volumes infinitesimais antes e depois da transformação...",
      },
      {
        document: "Stewart — Cálculo, vol. 2.pdf",
        page: 1054,
        snippet:
          "Teorema da mudança de variáveis: ∫∫∫_R f(x,y,z) dV = ∫∫∫_S f(g(u,v,w)) |∂(x,y,z)/∂(u,v,w)| dV'",
      },
    ],
  },
];

const subjects = ["Cálculo 2", "POO", "Banco de Dados II", "Redes"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("Cálculo 2");

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setMessages((m) => [...m, { role: "user", text: input }]);
    setInput("");
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="label-section mb-1">Tirar dúvida com IA · UC10</p>
          <h1 className="text-3xl font-bold text-ink-100">Pergunte sobre seus documentos</h1>
          <p className="text-ink-400 mt-1 max-w-2xl">
            A IA busca trechos nos PDFs da matéria selecionada e responde com citações da origem.
          </p>
        </div>
        <select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="rounded-lg bg-ink-900 border border-ink-700 px-3 py-2 text-sm text-ink-200"
        >
          {subjects.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </header>

      <section className="card flex flex-col" style={{ minHeight: "60vh" }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.map((m, i) => (
            <article key={i} className="flex gap-3">
              <div
                className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold ${
                  m.role === "user"
                    ? "bg-ink-900 border border-ink-700 text-ink-200"
                    : "bg-brand-500/15 border border-brand-500/30 text-brand-300"
                }`}
              >
                {m.role === "user" ? "MV" : <Sparkles size={14} />}
              </div>
              <div className="flex-1 space-y-3">
                <p className="text-sm text-ink-200 leading-relaxed">{m.text}</p>
                {m.sources && (
                  <div className="space-y-2">
                    <p className="label-section">Fontes</p>
                    {m.sources.map((src, j) => (
                      <div
                        key={j}
                        className="card-soft p-3 flex gap-3 text-xs hover:border-brand-500/40 cursor-pointer transition"
                      >
                        <FileText size={14} className="shrink-0 text-brand-400 mt-0.5" />
                        <div className="min-w-0">
                          <p className="text-ink-100 font-medium">
                            {src.document}{" "}
                            <span className="text-ink-500 font-normal">· pág. {src.page}</span>
                          </p>
                          <p className="text-ink-400 mt-1 italic">"{src.snippet}"</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>

        <form onSubmit={onSend} className="border-t border-ink-700 p-4 flex gap-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Pergunte algo sobre ${subject}...`}
            className="flex-1 rounded-lg bg-ink-900 border border-ink-700 px-4 py-2.5 text-ink-100 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition"
          />
          <Button type="submit" disabled={!input.trim()}>
            <Send size={14} /> Enviar
          </Button>
        </form>
      </section>
    </div>
  );
}
