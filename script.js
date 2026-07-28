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
const headerAvatar = document.querySelector("header .avatar");

const CHARACTERS = {
  yoshikun: {
    name: "よしくん",
    icon: "🐱",
    welcome: "よぉ！よしくんGPTにようこそ😺 何でも聞いてみな！"
  },
  teacher: {
    name: "教師",
    icon: "👨‍🏫",
    welcome: "こんにちは。教師モードです。順序立てて分かりやすく説明します。"
  },
  maid: {
    name: "メイド",
    icon: "☕",
    welcome: "お帰りなさいませ、ご主人様。メイドモードでお手伝いいたします。"
  },
  tsundere: {
    name: "ツンデレ",
    icon: "😳",
    welcome: "べ、別にあなたのためじゃないけど、質問くらい答えてあげるわよ。"
  },
  custom: {
    name: "カスタム",
    icon: "✏️",
    welcome: "カスタムキャラクターに変更したよ。下の設定欄に性格や口調を書いてね。"
  }
};

const hands = ["グー", "チョキ", "パー"];
const slotSymbols = ["🍒", "🍋", "🍇", "⭐", "💎", "7️⃣"];
let numberAnswer = Math.floor(Math.random() * 10) + 1;
let sending = false;
let isOnline = navigator.onLine;

const localKnowledge = {
  "こんにちは": "こんにちは！今日はどうしたの？",
  "おはよう": "おはよう！今日も無理せずいこう。",
  "こんばんは": "こんばんは。今日もお疲れさま。",
  "ありがとう": "どういたしまして！",
  "ゲーム": "ゲームいいね！最近は何を遊んでるの？🎮",
  "学校": "学校について、勉強・友達・進路のどれを話したい？",
  "仕事": "お仕事お疲れさま。困っていることを整理しよう。",
  "猫": "猫はかわいいよね！どんな猫が好き？🐱",
  "ai": "AIについて知りたいことを具体的に教えてね。",
  "ラーメン": "ラーメンなら、味・麺・具材の好みを教えて！🍜",
  "占い": "今日の運勢は『小さな挑戦が吉』。焦らず一歩ずつ！✨",
  "面白い話": "布団が吹っ飛んだ！……定番だけど、ちょっとは笑った？"
};

window.addEventListener("DOMContentLoaded", () => {
  loadHistory();
  loadTheme();
  loadCharacter();
  updateConnectionStatus();
  registerServiceWorker();
  if (!chat.children.length) addBot(currentCharacter().welcome);
  input.focus();
});

function currentCharacter() {
  return CHARACTERS[characterSelect?.value] || CHARACTERS.yoshikun;
}

function addMessage(text, type) {
  const template = type === "user" ? userTemplate : botTemplate;
  const node = template.content.cloneNode(true);
  node.querySelector(".text").textContent = String(text ?? "");
  if (type === "bot") node.querySelector(".icon").textContent = currentCharacter().icon;
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
      addBot(styleLocalReply(gameReply));
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
  if (!navigator.onLine) {
    return getLocalReply(message);
  }

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
    if (!contentType.includes("application/json")) throw new Error(`API returned non-JSON (${response.status})`);

    const data = await response.json();
    if (!response.ok) throw new Error(data.reply || `HTTP ${response.status}`);
    if (!data.reply) throw new Error("API reply is empty");
    return data.reply;
  } finally {
    clearTimeout(timeoutId);
  }
}

function getLocalReply(text) {
  const normalized = text.replace(/[！!？?。、,.]/g, "").trim().toLowerCase();
  let baseReply = "オフライン内蔵モードで動作中だよ。質問のキーワードを短く具体的にすると答えやすいよ。じゃんけん・数字当て・スロットも遊べます。";

  for (const [key, reply] of Object.entries(localKnowledge)) {
    if (normalized.includes(key)) {
      baseReply = reply;
      break;
    }
  }

  if (/疲れ|眠い|しんどい|つらい|落ち込|悲しい/.test(text)) {
    baseReply = "つらかったね。今日は無理をせず、少し休もう。話したいことがあれば聞くよ。";
  } else if (/嬉しい|楽しい|最高|やった/.test(text)) {
    baseReply = "それは良かったね！何があったのか、もっと聞かせて。";
  }

  return styleLocalReply(baseReply);
}

function styleLocalReply(reply) {
  switch (characterSelect.value) {
    case "teacher":
      return `先生として説明します。\n${reply}\n分からない点は、どこで迷ったか教えてください。`;
    case "maid":
      return `かしこまりました、ご主人様。\n${reply}`;
    case "tsundere":
      return `べ、別に特別に教えるわけじゃないけど……\n${reply}`;
    case "custom": {
      const custom = customPrompt.value.trim();
      return custom ? `【${custom.slice(0, 40)}】\n${reply}` : `カスタム設定を入力してね。\n${reply}`;
    }
    default:
      return `よしくんだよ😺\n${reply}`;
  }
}

function getGameReply(text) {
  return playJanken(text) || playNumber(text) || playSlot(text);
}

function playJanken(text) {
  if (!text.startsWith("じゃんけん")) return null;
  const user = text.replace("じゃんけん", "").trim();
  if (!hands.includes(user)) return "「じゃんけん グー」のように入力してね。";
  const bot = hands[Math.floor(Math.random() * hands.length)];
  const win = (user === "グー" && bot === "チョキ") || (user === "チョキ" && bot === "パー") || (user === "パー" && bot === "グー");
  const result = user === bot ? "あいこ！" : win ? "あなたの勝ち！🎉" : `${currentCharacter().name}の勝ち！`;
  return `あなた: ${user}\n${currentCharacter().name}: ${bot}\n\n${result}`;
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
  const message = result[0] === result[1] && result[1] === result[2] ? "🎉 JACKPOT！！" : new Set(result).size === 2 ? "😊 2つ揃った！" : "残念、もう一回！";
  return `${result.join(" ")}\n\n${message}`;
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function saveHistory() { localStorage.setItem("ygpt-history", chat.innerHTML); }
function loadHistory() {
  const data = localStorage.getItem("ygpt-history");
  if (data) chat.innerHTML = data;
}

function changeCharacter({ announce = true } = {}) {
  const character = currentCharacter();
  const isCustom = characterSelect.value === "custom";
  customPrompt.style.display = isCustom ? "block" : "none";
  headerAvatar.textContent = character.icon;
  updateConnectionStatus();
  document.body.dataset.character = characterSelect.value;
  localStorage.setItem("ygpt-character", characterSelect.value);

  if (announce) {
    addBot(`${character.icon} ${character.name}モードに変更しました。`);
    saveHistory();
  }
}

function loadCharacter() {
  const saved = localStorage.getItem("ygpt-character");
  if (saved && CHARACTERS[saved]) characterSelect.value = saved;
  customPrompt.value = localStorage.getItem("ygpt-custom-prompt") || "";
  changeCharacter({ announce: false });
}


function updateConnectionStatus() {
  isOnline = navigator.onLine;
  const character = currentCharacter();
  status.textContent = isOnline
    ? `● ${character.name}とオンライン`
    : `● ${character.name}・オフライン内蔵モード`;
  status.dataset.online = String(isOnline);
}

window.addEventListener("online", () => {
  updateConnectionStatus();
  addBot("通信が復旧したよ。AIサーバーが使える場合はオンライン回答に戻ります。");
  saveHistory();
});

window.addEventListener("offline", () => {
  updateConnectionStatus();
  addBot("オフラインになりました。内蔵知識・ゲーム・履歴機能はそのまま使えます。");
  saveHistory();
});

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./sw.js").catch(error => {
    console.warn("Service Worker registration failed:", error);
  });
}

window.changeCharacter = () => changeCharacter({ announce: true });
customPrompt.addEventListener("input", () => localStorage.setItem("ygpt-custom-prompt", customPrompt.value));

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
  addBot("会話を削除したよ。");
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
  recognition.addEventListener("result", event => { input.value = event.results[0][0].transcript; });
  recognition.addEventListener("error", () => addBot("音声入力を開始できなかったよ。マイク権限を確認してね。"));
  voiceBtn.addEventListener("click", () => recognition.start());
} else if (voiceBtn) {
  voiceBtn.disabled = true;
  voiceBtn.title = "このブラウザは音声入力に対応していません";
}
