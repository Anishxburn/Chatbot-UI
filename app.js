const API_URL = "/api";
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const messages = document.querySelector("#messages");
const status = document.querySelector("#status");
const statusDot = document.querySelector("#status-dot");
const sendButton = document.querySelector("#send-button");
const clearChat = document.querySelector("#clear-chat");
const promptButtons = document.querySelectorAll(".prompt");

function addMessage(text, role, meta = {}) {
  const message = document.createElement("article");
  message.className = `message ${role}`;

  const avatar = document.createElement("span");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  if (role === "assistant" && Array.isArray(meta.agentTrace) && meta.agentTrace.length > 0) {
    bubble.append(createFlowDetails(meta.agentTrace, meta.sources));
  }

  message.append(avatar, bubble);
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
  return message;
}

function createFlowDetails(agentTrace, sources = []) {
  const details = document.createElement("details");
  details.className = "flow-details";

  const summary = document.createElement("summary");
  summary.textContent = "System flow";
  details.append(summary);

  const list = document.createElement("ol");
  list.className = "flow-list";

  agentTrace.forEach((step) => {
    const item = document.createElement("li");
    const title = document.createElement("strong");
    title.textContent = `${step.agent}: ${step.status}`;
    const detail = document.createElement("span");
    detail.textContent = step.detail;
    item.append(title, detail);
    list.append(item);
  });

  details.append(list);

  if (Array.isArray(sources) && sources.length > 0) {
    const sourceTitle = document.createElement("p");
    sourceTitle.className = "flow-source-title";
    sourceTitle.textContent = "Sources";
    details.append(sourceTitle);

    const sourceList = document.createElement("ul");
    sourceList.className = "source-list";
    sources.forEach((source) => {
      const item = document.createElement("li");
      const score = Number(source.score || 0).toFixed(2);
      item.textContent = `${source.title || "EMS Library"} (${source.standard_name || "general"}, score ${score})`;
      sourceList.append(item);
    });
    details.append(sourceList);
  }

  return details;
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
    addMessage(data.reply, "assistant", {
      agentTrace: data.agent_trace,
      sources: data.sources,
    });
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
