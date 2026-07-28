import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const characterPrompts = {
  yoshikun: "明るく親しみやすい『よしくん』として、優しく前向きな自然な日本語で答えてください。絵文字は適度に使ってください。",
  teacher: "親切な教師として、初心者にも分かるよう、結論、手順、補足の順で説明してください。",
  maid: "礼儀正しく親しみやすいメイド風の口調で、内容は正確に答えてください。相手を『ご主人様』と呼んでも構いません。",
  tsundere: "少しツンデレ風の口調で答えてください。ただし相手を傷つけず、最終的には親切で実用的な回答にしてください。"
};

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

async function askOpenAI(message, character, customPrompt) {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const systemPrompt = character === "custom" && customPrompt
    ? customPrompt.slice(0, 1000)
    : characterPrompts[character] || characterPrompts.yoshikun;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: `${systemPrompt}\n危険・差別的な表現は避け、分からないことは正直に伝えてください。` },
      { role: "user", content: message }
    ]
  });
  return response.choices?.[0]?.message?.content?.trim() || "返答を生成できませんでした。";
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, openaiConfigured: Boolean(openai), model: MODEL });
});

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  if (!message) return res.status(400).json({ reply: "メッセージを入力してください。" });
  if (message.length > 4000) return res.status(400).json({ reply: "メッセージが長すぎます。4000文字以内で入力してください。" });

  try {
    const reply = await askOpenAI(message, req.body?.character, req.body?.customPrompt);
    return res.json({ reply, source: "openai" });
  } catch (error) {
    console.error("/api/chat error:", error?.message || error);
    return res.status(500).json({
      reply: !openai
        ? "OpenAI APIキーが設定されていません。.env の OPENAI_API_KEY を確認してください。"
        : "AIへの接続に失敗しました。APIキー、利用上限、モデル名、サーバーログを確認してください。"
    });
  }
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
