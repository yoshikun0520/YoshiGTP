"use strict";

const chat = document.getElementById("chat");
const input = document.getElementById("input");
const sendBtn = document.getElementById("send");
const darkBtn = document.getElementById("darkBtn");
const menuBtn = document.getElementById("menuBtn");
const menu = document.getElementById("menu");
const typing = document.getElementById("typing");
const quickArea = document.getElementById("quickArea");
const userTemplate = document.getElementById("userTemplate");
const botTemplate = document.getElementById("botTemplate");
const status = document.getElementById("status");
const characterSelect = document.getElementById("characterSelect");
const customPrompt = document.getElementById("customPrompt");

const hands = ["グー", "チョキ", "パー"];
const slotSymbols = ["🍒", "🍋", "🍇", "⭐", "💎", "7️⃣"];
let numberAnswer = Math.floor(Math.random() * 10) + 1;
let sending = false;

const localKnowledge = {
  "こんにちは": ["こんにちは！今日もよろしくね😺", "やあ！何でも話してね。"],
  "おはよう": ["おはよう！今日も良い一日にしよう☀️"],
  "こんばんは": ["こんばんは！今日も一日お疲れさま🌙"],
  "ありがとう": ["どういたしまして！また何でも聞いてね😊"],
  "ゲーム": ["ゲームいいね！最近は何を遊んでるの？🎮"],
  "学校": ["学校お疲れさま。今日はどんな一日だった？"],
  "仕事": ["お仕事お疲れさま。無理しすぎず休んでね。"],
  "猫": ["猫はかわいいよね！どんな猫が好き？🐱"],
  "AI": ["AIについて知りたいことを具体的に教えてね。"],
  "ラーメン": ["ラーメンいいね！醤油、味噌、豚骨ならどれが好き？🍜"],
  "占い": ["今日の運勢は中吉！小さな挑戦が良い流れを呼びそう✨"],
  "面白い話": ["冷蔵庫が走り出したら、きっと『冷えてる場合じゃない！』ってことだね😺"]
};

window.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  loadTheme();
  if (!chat.children.length) addBot("こんにちは！よしくんGPTだよ😺 何でも聞いてね。");
  input.focus();
});

function addMessage(text, type) {
  const template = type === "user" ? userTemplate : botTemplate;
  const node = template.content.cloneNode(true);
  node.querySelector(".text").textContent = String(text ?? "");
  chat.appendChild(node);
  scrollBottom();
}

function addUser(text) { addMessage(text, "user"); }
function addBot(text) { addMessage(text, "bot"); }
function scrollBottom() { chat.scrollTop = chat.scrollHeight; }
function showTyping() { typing.classList.add("show"); }
function hideTyping() { typing.classList.remove("show"); }

async function sendMessage() {
  const text = input.value.trim();
  if (!text || sending) return;

  sending = true;
  sendBtn.disabled = true;
  addUser(text);
  input.value = "";
  showTyping();

  try {
    const gameReply = getGameReply(text);
    if (gameReply) {
      await delay(350);
      addBot(gameReply);
      return;
    }

    const reply = await requestAI(text);
    addBot(reply);
  } catch (error) {
    console.error("Chat error:", error);
    addBot(getLocalReply(text));
  } finally {
    hideTyping();
    sending = false;
    sendBtn.disabled = false;
    saveHistory();
    input.focus();
  }
}

async function requestAI(message) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        character: characterSelect?.value || "yoshikun",
        customPrompt: customPrompt?.value.trim() || ""
      }),
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      throw new Error(`API returned non-JSON (${response.status})`);
    }

    const data = await response.json();
    if (!response.ok) throw new Error(data.reply || `HTTP ${response.status}`);
    if (!data.reply) throw new Error("API reply is empty");
    return data.reply;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getLocalReply(text) {
  const normalized = text.replace(/[！!？?。、,.]/g, "").trim();
  for (const [key, replies] of Object.entries(localKnowledge)) {
    if (normalized.toLowerCase().includes(key.toLowerCase())) {
      return replies[Math.floor(Math.random() * replies.length)];
    }
  }

  if (/疲れ|眠い|しんどい|つらい|落ち込|悲しい/.test(text)) {
    return "つらかったね。今日は無理をせず、少し休もう。話したいことがあれば聞くよ。";
  }
  if (/嬉しい|楽しい|最高|やった/.test(text)) {
    return "それは良かったね！何があったのか、もっと聞かせて😊";
  }

  return "今はAIサーバーに接続できないため、内蔵モードで返答しているよ。サーバー起動とAPIキー設定を確認してね。";
}

function getGameReply(text) {
  const janken = playJanken(text);
  if (janken) return janken;
  const number = playNumber(text);
  if (number) return number;
  return playSlot(text);
}

function playJanken(text) {
  if (!text.startsWith("じゃんけん")) return null;
  const user = text.replace("じゃんけん", "").trim();
  if (!hands.includes(user)) return "「じゃんけん グー」のように入力してね。";
  const bot = hands[Math.floor(Math.random() * hands.length)];
  const win = (user === "グー" && bot === "チョキ") ||
    (user === "チョキ" && bot === "パー") ||
    (user === "パー" && bot === "グー");
  const result = user === bot ? "あいこ！" : win ? "あなたの勝ち！🎉" : "よしくんの勝ち！😺";
  return `あなた: ${user}\nよしくん: ${bot}\n\n${result}`;
}

function playNumber(text) {
  if (!text.startsWith("数字")) return null;
  const value = Number.parseInt(text.replace("数字", "").trim(), 10);
  if (!Number.isInteger(value) || value < 1 || value > 10) return "「数字 5」のように1〜10で入力してね。";
  if (value === numberAnswer) {
    numberAnswer = Math.floor(Math.random() * 10) + 1;
    return "🎉 正解！次の数字も決めたよ。";
  }
  return value < numberAnswer ? "もっと大きい数字！" : "もっと小さい数字！";
}

function playSlot(text) {
  if (text.trim() !== "スロット") return null;
  const result = Array.from({ length: 3 }, () => slotSymbols[Math.floor(Math.random() * slotSymbols.length)]);
  const message = result[0] === result[1] && result[1] === result[2]
    ? "🎉 JACKPOT！！"
    : new Set(result).size === 2 ? "😊 2つ揃った！" : "残念、もう一回！";
  return `${result.join(" ")}\n\n${message}`;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function saveHistory() { localStorage.setItem("ygpt-history", chat.innerHTML); }
function loadHistory() {
  const data = localStorage.getItem("ygpt-history");
  if (data) chat.innerHTML = data;
}

function changeCharacter() {
  const isCustom = characterSelect.value === "custom";
  customPrompt.style.display = isCustom ? "block" : "none";
  const label = characterSelect.options[characterSelect.selectedIndex].textContent.replace(/^\S+\s*/, "");
  status.textContent = `● ${label}とオンライン`;
}
window.changeCharacter = changeCharacter;

sendBtn.addEventListener("click", sendMessage);
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.isComposing) {
    event.preventDefault();
    sendMessage();
  }
});

darkBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  localStorage.setItem("ygpt-dark", document.body.classList.contains("dark") ? "1" : "0");
});
function loadTheme() {
  if (localStorage.getItem("ygpt-dark") === "1") document.body.classList.add("dark");
}

menuBtn.addEventListener("click", () => menu.classList.toggle("open"));
quickArea.querySelectorAll("button").forEach(button => {
  button.addEventListener("click", () => {
    input.value = button.textContent.trim();
    sendMessage();
  });
});

document.getElementById("clearHistory")?.addEventListener("click", () => {
  localStorage.removeItem("ygpt-history");
  chat.innerHTML = "";
  addBot("履歴を削除したよ。");
});

document.getElementById("exportHistory")?.addEventListener("click", () => {
  const blob = new Blob([chat.innerText], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `yoshikun-chat-${new Date().toISOString().slice(0, 10)}.txt`;
  anchor.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importHistory")?.addEventListener("click", () => {
  const picker = document.createElement("input");
  picker.type = "file";
  picker.accept = ".txt,text/plain";
  picker.addEventListener("change", async () => {
    const file = picker.files?.[0];
    if (!file) return;
    addBot(`読み込んだ履歴:\n${await file.text()}`);
    saveHistory();
  });
  picker.click();
});

document.getElementById("speechBtn")?.addEventListener("click", () => {
  const last = chat.lastElementChild?.innerText;
  if (!last || !("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(last);
  utterance.lang = "ja-JP";
  speechSynthesis.speak(utterance);
});

const voiceBtn = document.getElementById("voiceBtn");
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (voiceBtn && SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = "ja-JP";
  recognition.addEventListener("result", event => {
    input.value = event.results[0][0].transcript;
  });
  recognition.addEventListener("error", () => addBot("音声入力を開始できなかったよ。マイク権限を確認してね。"));
  voiceBtn.addEventListener("click", () => recognition.start());
} else if (voiceBtn) {
  voiceBtn.disabled = true;
  voiceBtn.title = "このブラウザは音声入力に対応していません";
}
