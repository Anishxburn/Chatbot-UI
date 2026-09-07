const API_URL = "http://127.0.0.1:8000";
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message");
const messages = document.querySelector("#messages");
const status = document.querySelector("#status");

function addMessage(text, role) {
  const message = document.createElement("article");
  message.className = `message ${role}`;
  message.textContent = text;
  messages.append(message);
  messages.scrollTop = messages.scrollHeight;
}

async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    if (!response.ok) throw new Error("Service unavailable");
    status.textContent = "AI service online";
    status.classList.add("online");
  } catch {
    status.textContent = "AI service offline";
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  addMessage(message, "user");
  input.value = "";
  input.disabled = true;

  try {
    const response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Request failed");
    addMessage(data.reply, "assistant");
  } catch (error) {
    addMessage(`Could not reach AI-Server: ${error.message}`, "error");
  } finally {
    input.disabled = false;
    input.focus();
  }
});

checkHealth();
