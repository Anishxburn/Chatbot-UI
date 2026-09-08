# ?? External Systems - LLM API Access

## Your Local LLM is Ready!

Your team/applications can now access a **local LLM (Ollama)** through a simple HTTP API.

---

## ? Quick Start (Copy-Paste Ready)

### Health Check First

\\\ash
curl http://192.228.0.109:8085/api/health
\\\

Expected response:
\\\json
{"status": "ok", "service": "AI-Server"}
\\\

### Send Your First Message

\\\ash
curl -X POST http://192.228.0.109:8085/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"What is machine learning?"}'
\\\

Expected response:
\\\json
{
  "reply": "Machine learning is a type of artificial intelligence...",
  "provider": "ollama",
  "model": "llama3.2:1b"
}
\\\

---

## ?? API Details

| Item | Value |
|------|-------|
| **API URL** | \http://192.228.0.109:8085/api/chat\ |
| **Method** | \POST\ |
| **Content-Type** | \pplication/json\ |
| **Response Time** | 1-2 seconds (llama3.2:1b model) |

### Alternative IP (if primary doesn't work)
\\\
http://192.168.0.29:8085/api/chat
\\\

---

## ?? Request Format

\\\json
{
  "message": "Your question or prompt here"
}
\\\

---

## ?? Response Format

\\\json
{
  "reply": "The AI's answer",
  "provider": "ollama",
  "model": "llama3.2:1b"
}
\\\

---

## ?? Code Examples

### Python (Recommended)

\\\python
import requests

def ask_llm(question):
    url = "http://192.228.0.109:8085/api/chat"
    response = requests.post(
        url,
        json={"message": question},
        headers={"Content-Type": "application/json"}
    )
    if response.status_code == 200:
        return response.json()["reply"]
    return f"Error: {response.status_code}"

# Usage
print(ask_llm("What is Python?"))
\\\

### JavaScript

\\\javascript
async function askLLM(message) {
  const response = await fetch("http://192.228.0.109:8085/api/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({ message: message })
  });
  const data = await response.json();
  return data.reply;
}

askLLM("What is JavaScript?").then(console.log);
\\\

### cURL

\\\ash
curl -X POST http://192.228.0.109:8085/api/chat \\
  -H "Content-Type: application/json" \\
  -d '{"message":"Hello"}'
\\\

---

## ?? Summary

**Endpoint:**
\\\
POST http://192.228.0.109:8085/api/chat
\\\

**Request:**
\\\json
{"message": "Your question"}
\\\

**Response:**
\\\json
{"reply": "Answer", "provider": "ollama", "model": "llama3.2:1b"}
\\\

For more details, see EXTERNAL_API_GUIDE.md

**That's it!** Start using the LLM in your applications. ??
