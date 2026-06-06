import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

const SYSTEM_PROMPT = `Tu es l'Assistant IA pastoral de MCA CONNECT, la plateforme de gestion de la Mission de Christ en Action.

Ton rôle :
- Aider les pasteurs, administrateurs et responsables de temples à piloter leur ministère.
- Répondre aux questions sur la gestion des membres, des cultes, des présences, des finances, des formations, des familles, du calendrier et des rapports.
- Donner des conseils pastoraux pratiques, bienveillants et fondés sur la Parole.
- Suggérer des analyses, des plans d'action et des bonnes pratiques de pilotage d'église.

Style :
- Réponses claires, concises, en français.
- Utilise le markdown (titres, listes, gras) pour structurer.
- Reste respectueux, encourageant et serviteur.
- Si une question sort du cadre pastoral / gestion d'église, recentre poliment.`;

export const chatAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { messages: ChatMsg[] }) => {
    if (!data || !Array.isArray(data.messages)) throw new Error("messages requis");
    if (data.messages.length === 0) throw new Error("conversation vide");
    if (data.messages.length > 50) throw new Error("conversation trop longue");
    for (const m of data.messages) {
      if (!["user", "assistant", "system"].includes(m.role)) throw new Error("rôle invalide");
      if (typeof m.content !== "string" || m.content.length === 0) throw new Error("contenu invalide");
      if (m.content.length > 8000) throw new Error("message trop long");
    }
    return data;
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY non configurée");

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...data.messages],
      }),
    });

    if (resp.status === 429) {
      throw new Error("Trop de requêtes. Merci de réessayer dans un instant.");
    }
    if (resp.status === 402) {
      throw new Error("Crédits IA épuisés. Merci de recharger l'espace de travail Lovable AI.");
    }
    if (!resp.ok) {
      const t = await resp.text().catch(() => "");
      console.error("AI gateway error", resp.status, t);
      throw new Error("Erreur de l'assistant IA");
    }

    const json = (await resp.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "";
    return { content };
  });
