import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import ReactMarkdown from "react-markdown";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, RefreshCw, Bot, User } from "lucide-react";
import { toast } from "sonner";
import { chatAssistant } from "@/lib/assistant.functions";

export const Route = createFileRoute("/_app/assistant")({ component: AssistantPage });

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Comment améliorer le taux de présence aux cultes ?",
  "Donne-moi un plan d'action pour relancer les âmes inactives",
  "Rédige une exhortation courte sur la persévérance",
  "Quels indicateurs suivre chaque mois pour piloter mon temple ?",
];

function AssistantPage() {
  const send = useServerFn(chatAssistant);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const ask = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    const next: Msg[] = [...messages, { role: "user", content: trimmed }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await send({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: res.content || "(réponse vide)" }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inattendue";
      toast.error(msg);
      setMessages(next.slice(0, -1));
      setInput(trimmed);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setMessages([]);
    setInput("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Sparkles className="h-6 w-6" /></div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Assistant IA pastoral</h1>
            <p className="text-sm text-muted-foreground">
              Conseils, analyses et idées pour piloter ton ministère — propulsé par Lovable AI
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RefreshCw className="h-4 w-4 mr-2" /> Nouvelle conversation
          </Button>
        )}
      </div>

      <Card className="flex flex-col h-[calc(100vh-16rem)] min-h-[480px]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center gap-4 p-6">
              <div className="rounded-full bg-primary/10 p-4 text-primary"><Bot className="h-8 w-8" /></div>
              <div>
                <div className="font-semibold text-foreground">Bonjour, je suis ton assistant pastoral</div>
                <div className="text-sm text-muted-foreground mt-1">Pose-moi une question ou choisis un sujet ci-dessous.</div>
              </div>
              <div className="grid gap-2 w-full max-w-xl">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="text-left text-sm rounded-lg border border-border bg-card hover:bg-muted/50 transition px-3 py-2.5 text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              {m.role === "assistant" && (
                <div className="shrink-0 rounded-full bg-primary/10 text-primary p-2 h-8 w-8 flex items-center justify-center">
                  <Bot className="h-4 w-4" />
                </div>
              )}
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-2 prose-ul:my-2 prose-ol:my-2">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{m.content}</div>
                )}
              </div>
              {m.role === "user" && (
                <div className="shrink-0 rounded-full bg-foreground/10 text-foreground p-2 h-8 w-8 flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="shrink-0 rounded-full bg-primary/10 text-primary p-2 h-8 w-8 flex items-center justify-center">
                <Bot className="h-4 w-4" />
              </div>
              <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Réflexion...
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-3">
          <form
            onSubmit={(e) => { e.preventDefault(); ask(input); }}
            className="flex items-end gap-2"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  ask(input);
                }
              }}
              placeholder="Pose ta question pastorale ou de gestion..."
              rows={2}
              className="resize-none"
              disabled={loading}
            />
            <Button type="submit" disabled={loading || !input.trim()} size="lg">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>Entrée pour envoyer · Maj+Entrée pour aller à la ligne</span>
            <Badge variant="outline" className="text-[10px]">Gemini · Lovable AI</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}
