# Chatbot Stack - Quick Start Guide

Your local AI chatbot with Ollama, running entirely on your machine.

## 30-Second Setup

```powershell
cd C:\chatbot-stack\Chatbot-UI
docker compose up --build
```

Open **http://127.0.0.1:8085** → Start chatting!

## What's Running?

| Component | Purpose | Port |
|-----------|---------|------|
| **Chatbot UI** | Web interface | 8085 |
| **AI-Server** | Chat API | 8000 (internal) |
| **Ollama** | Local LLM inference | 11435 |
| **nginx** | Reverse proxy | (internal) |

## First Messages to Try

The UI has quick prompts, or type your own:

- "What is the chatbot stack?"
- "Give me 3 UI improvement ideas"
- "Draft a friendly welcome message"

## Change the AI Model

Different models trade off speed vs. quality:

```powershell
# Fast (500MB, ~1s per response)
$env:OLLAMA_MODEL="llama3.2:1b"
docker compose up --build

# Balanced (2GB, ~5s per response)
$env:OLLAMA_MODEL="llama3.2:3b"
docker compose up --build

# Best quality (4GB, ~15s per response)
$env:OLLAMA_MODEL="llama3.2:7b"
docker compose up --build
```

See [OLLAMA_MODELS.md](OLLAMA_MODELS.md) for all available models.

## Common Commands

### See What's Running

```powershell
docker compose ps
```

### Watch Logs

```powershell
docker compose logs -f chatbot-api
docker compose logs -f ollama
```

### Restart Everything

```powershell
docker compose restart
```

### Stop Everything

```powershell
docker compose down
```

### Remove Everything (Free Disk Space)

```powershell
docker compose down -v
```

⚠️ This deletes downloaded models — they'll re-download on next startup.

## Test the APIs Directly

### Health Check

```powershell
curl http://127.0.0.1:8085/api/health
# {"status": "ok", "service": "AI-Server"}
```

### Send a Message

```powershell
curl -X POST http://127.0.0.1:8085/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"What is 2+2?\"}"
# {"reply": "2 + 2 = 4", "provider": "ollama", "model": "llama3.2:1b"}
```

### View Request Traces

```powershell
curl http://127.0.0.1:8085/api/debug/traces | jq '.traces[0]'
```

## Troubleshooting

**"Can't connect to http://127.0.0.1:8085"**
- Check Docker is running: `docker ps`
- Check port is available: Not already in use
- Check logs: `docker compose logs`

**"Thinking..." never completes**
- Ollama might still be pulling the model
- Check logs: `docker compose logs ollama-init`
- Check Ollama health: `curl http://127.0.0.1:11435/api/tags`

**Responses are too slow**
- You're using a large model (good quality, but slow)
- Switch to `llama3.2:1b` or `llama3.2:3b` for faster responses
- Or wait for responses (large models are worth it!)

**Docker volume taking up space**
- Run `docker compose down -v` to delete models
- Or just let them persist (they'll re-use the cached download)

## Next Steps

1. **Explore the code:**
   - Backend API: [AI-Server/server.py](AI-Server/server.py)
   - Frontend: [Chatbot-UI/index.html](Chatbot-UI/index.html) + [app.js](Chatbot-UI/app.js)
   - Docker setup: [Chatbot-UI/docker-compose.yml](Chatbot-UI/docker-compose.yml)

2. **Customize the chatbot:**
   - Add a system prompt in `server.py`
   - Modify UI styling in `styles.css`
   - Change quick prompts in `index.html`

3. **Learn more:**
   - [OLLAMA_MODELS.md](OLLAMA_MODELS.md) — Model selection guide
   - [Ollama Docs](https://ollama.ai) — Official Ollama documentation
   - [Chatbot-UI/README.md](Chatbot-UI/README.md) — Local dev setup

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│            Browser (Port 8085)                      │
│  ┌────────────────────────────────────────────────┐ │
│  │  Chatbot UI (HTML + JS + CSS)                 │ │
│  │  - Message input/display                      │ │
│  │  - Status indicator                           │ │
│  │  - Quick prompt buttons                       │ │
│  └────────────────────────────────────────────────┘ │
└──────────────────────┬────────────────────────────────┘
                       │ HTTP POST /api/chat
                       │ (JSON: {message: "..."})
┌──────────────────────▼────────────────────────────────┐
│      nginx Reverse Proxy (Docker Internal)            │
└──────────────────────┬────────────────────────────────┘
                       │ localhost:8000
┌──────────────────────▼────────────────────────────────┐
│  AI-Server (Python, Port 8000)                       │
│  ┌────────────────────────────────────────────────┐  │
│  │  server.py: HTTP API                          │  │
│  │  - Validates JSON requests                    │  │
│  │  - Logs traces                                │  │
│  │  - Calls Ollama                               │  │
│  │  - Returns JSON responses                     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────┬────────────────────────────────┘
                       │ HTTP POST
                       │ /api/generate
┌──────────────────────▼────────────────────────────────┐
│  Ollama (Port 11434, exposed on 11435)               │
│  ┌────────────────────────────────────────────────┐  │
│  │  LLM Inference Engine                         │  │
│  │  - Manages models (llama3.2, mistral, etc.)   │  │
│  │  - Runs inference (CPU or GPU)                │  │
│  │  - Returns generated text                     │  │
│  │  - Stores models in Docker volume             │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Data Flow:**
1. User types message in browser
2. Frontend sends JSON to `/api/chat`
3. nginx proxy routes to `chatbot-api`
4. Backend validates and logs request
5. Backend calls Ollama's `/api/generate`
6. Ollama runs inference and returns completion
7. Backend returns response as JSON
8. Frontend displays response in chat

That's it! Everything runs locally, nothing leaves your machine.

## System Requirements

- **Docker Desktop** (with Docker Engine)
- **4GB RAM** minimum (8GB recommended)
- **2GB disk space** for base images + at least 2GB per model

## Ports Used

- **8085** — Chatbot UI (web interface)
- **11435** — Ollama API (for testing/debugging)
- **8000** — AI-Server API (internal)

If any are in use, change them with environment variables before `docker compose up`.
