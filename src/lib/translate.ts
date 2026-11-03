import "server-only";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic(); // ключ — ANTHROPIC_API_KEY из .env.local

/**
 * Перевод описания машины на английский для EN-версии сайта.
 * Ошибка (нет ключа, сеть, отказ) не мешает сохранению: возвращает "" — тогда на английском сайте покажется русский текст.
 */
export async function translateToEnglish(text: string): Promise<string> {
  if (!text.trim()) return "";
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 4000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system:
        "You translate car descriptions for a car rental website in Batumi, Georgia, from Russian into natural English. " +
        "Keep the meaning, line breaks and any numbers. Reply with the translation only, no comments.",
      messages: [{ role: "user", content: text }],
    });
    if (response.stop_reason === "refusal") return "";
    return response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  } catch (e) {
    console.error("Перевод описания не удался:", e instanceof Error ? e.message : e);
    return "";
  }
}
