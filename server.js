import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import knowledge from "./data/knowledge.js";

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const aliases = { "こんばんわ": "こんばんは", "ありがと": "ありがとう", "おっす": "こんにちは" };
const characterPrompts = {
  yoshikun: "明るく親しみやすい『よしくん』として、優しく前向きな自然な日本語で答えてください。絵文字は適度に使ってください。",
  teacher: "親切な教師として、初心者にも分かるよう順序立てて説明してください。",
  maid: "礼儀正しく親しみやすいメイド風の口調で、内容は正確に答えてください。",
  tsundere: "少しツンデレ風ですが、相手を傷つけず、最後は親切に答えてください。"
};

function searchKnowledge(rawMessage) {
  let message = String(rawMessage || "").trim().toLowerCase().replace(/[！!？?。、,.]/g, "");
  message = aliases[message] || message;
  let bestKey = "";
  for (const key of Object.keys(knowledge)) {
    if (message.includes(key.toLowerCase()) && key.length > bestKey.length) bestKey = key;
  }
  if (!bestKey) return null;
  const replies = knowledge[bestKey];
  return Array.isArray(replies) && replies.length ? replies[Math.floor(Math.random() * replies.length)] : null;
}

async function askOpenAI(message, character, customPrompt) {
  if (!openai) throw new Error("OPENAI_API_KEY is not configured");
  const systemPrompt = character === "custom" && customPrompt
    ? customPrompt.slice(0, 1000)
    : characterPrompts[character] || characterPrompts.yoshikun;

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: `${systemPrompt}\n暴言、差別、性的な表現は避け、分からないことは正直に伝えてください。` },
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
    const localAnswer = searchKnowledge(message);
    if (localAnswer) return res.json({ reply: localAnswer, source: "knowledge" });

    const reply = await askOpenAI(message, req.body?.character, req.body?.customPrompt);
    return res.json({ reply, source: "openai" });
  } catch (error) {
    console.error("/api/chat error:", error?.message || error);
    const missingKey = !openai;
    return res.status(500).json({
      reply: missingKey
        ? "OpenAI APIキーが設定されていません。.env の OPENAI_API_KEY を確認してください。"
        : "AIへの接続に失敗しました。APIキー、利用上限、モデル名、サーバーログを確認してください。"
    });
  }
});

app.get("*splat", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(PORT, () => {
  console.log(`🚀 よしくんGPT: http://localhost:${PORT}`);
  console.log(`🤖 OpenAI: ${openai ? "configured" : "not configured"} / model=${MODEL}`);
});
