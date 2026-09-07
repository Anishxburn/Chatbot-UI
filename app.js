const API_URL = "/api";
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const messages = document.querySelector("#messages");
const status = document.querySelector("#status");
const statusDot = document.querySelector("#status-dot");
const sendButton = document.querySelector("#send-button");
const clearChat = document.querySelector("#clear-chat");
const promptButtons = document.querySelectorAll(".prompt");

function addMessage(text, role) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  message.append(avatar, bubble);
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

function setBusy(isBusy) {
  input.disabled = isBusy;
  sendButton.disabled = isBusy;
  sendButton.textContent = isBusy ? "Sending" : "Send";
}

function setStatus(state, label) {
  status.textContent = label;
  statusDot.className = `status-dot ${state}`;
}

function resizeComposer() {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) throw new Error("Service unavailable");
    setStatus("online", "AI-Server online");
  } catch {
    setStatus("offline", "AI-Server offline");
  }
}

async function sendMessage(message) {
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  resizeComposer();
  setBusy(true);
  const typing = addMessage("Thinking...", "assistant typing");

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    typing.remove();
    addMessage(data.reply, "assistant");
  } catch (error) {
    typing.remove();
    addMessage(`Could not reach AI-Server: ${error.message}`, "error");
  } finally {
    setBusy(false);
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value.trim());
});

input.addEventListener("input", resizeComposer);

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

clearChat.addEventListener("click", () => {
  messages.innerHTML = "";
  addMessage("Chat cleared. Send a fresh message whenever you are ready.", "assistant");
  input.focus();
});

promptButtons.forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.textContent;
    resizeComposer();
    input.focus();
  });
});

checkHealth();
