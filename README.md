# Chatbot Stack

A complete, self-contained local AI chatbot with:

- **Frontend:** Responsive vanilla JavaScript web UI
- **Backend:** Python HTTP API
- **LLM:** Ollama (runs models locally)
- **Infrastructure:** Docker Compose (all services containerized)

No API keys. No cloud. No data leaving your machine.

## 30-Second Start

```powershell
docker compose up --build
```

Open **http://127.0.0.1:8085** and start chatting!

👉 **New? Start here:** [QUICKSTART.md](QUICKSTART.md)

## Documentation

| Guide | Purpose |
|-------|---------|
| [QUICKSTART.md](QUICKSTART.md) | Get running in 30 seconds, basic commands |
| [OLLAMA_MODELS.md](OLLAMA_MODELS.md) | Model selection, performance, tuning |
| [DEBUGGING.md](DEBUGGING.md) | Troubleshooting, logs, API testing |
| [README-PROJECT.md](README-PROJECT.md) | Full project overview and architecture |

## Quick Commands

```powershell
# Start the stack
docker compose up --build

# Use a different model
$env:OLLAMA_MODEL = "mistral:7b"
docker compose up --build

# View logs
docker compose logs -f chatbot-api

# Test the API
curl http://127.0.0.1:8085/api/health
curl -X POST http://127.0.0.1:8085/api/chat -H "Content-Type: application/json" -d "{\"message\":\"Hello\"}"
```

## Features

- ✅ **Completely Local** — Ollama runs inference on your machine
- ✅ **No API Keys** — No third-party dependencies
- ✅ **Privacy** — All data stays on your device
- ✅ **Fast Setup** — One command to start
- ✅ **Extensible** — Easy to customize and modify
- ✅ **Debuggable** — Request traces and logs included

## Services

| Service | Port | Purpose |
|---------|------|---------|
| Chatbot UI | 8085 | Web interface |
| AI-Server API | 8000 | Backend (internal) |
| Ollama | 11435 | LLM engine (for testing) |

## Docker Compose Setup

The stack includes:

- **ollama** — Local LLM inference engine with model caching
- **ollama-init** — Bootstrapper that pulls the configured model
- **chatbot-api** — Python HTTP API routing messages to Ollama
- **chatbot-ui** — Nginx web server with reverse proxy to API

All services communicate through Docker's internal network.

## Environment Configuration

Create a `.env` file (copy from `.env.example`):

```powershell
cp .env.example .env
```

Then edit it:

```env
# UI port
CHATBOT_UI_PORT=8085

# Ollama model (see OLLAMA_MODELS.md for options)
OLLAMA_MODEL=llama3.2:1b

# API configuration
CHATBOT_HOST=0.0.0.0
CHATBOT_PORT=8000
```

## Development

### Local Setup (No Docker)

**Backend:**
```powershell
cd ..\AI-Server
python server.py
```

**Frontend:**
```powershell
python -m http.server 5500
```

Open http://127.0.0.1:5500

### With Docker

```powershell
# Rebuild and restart
docker compose up --build

# Watch logs
docker compose logs -f

# Run command in container
docker compose exec chatbot-api python -c "print('hello')"
```

## API Reference

### Health Check

```powershell
curl http://127.0.0.1:8085/api/health
# {"status": "ok", "service": "AI-Server"}
```

### Send a Message

```powershell
curl -X POST http://127.0.0.1:8085/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is 2+2?"}'
# {"reply": "2 + 2 = 4", "provider": "ollama", "model": "llama3.2:1b"}
```

### View Traces

```powershell
curl http://127.0.0.1:8085/api/debug/traces | jq '.traces[0]'
```

View the last 25 requests with timing, models, and error info.

## Common Issues

**Can't connect to http://127.0.0.1:8085**
- Check Docker is running: `docker ps`
- Check services are up: `docker compose ps`
- View logs: `docker compose logs`

**"Thinking..." never completes**
- Ollama might still be downloading the model
- Check: `docker compose logs ollama-init`
- Or: `curl http://127.0.0.1:11435/api/tags`

**Responses are too slow**
- Use a faster model: `$env:OLLAMA_MODEL = "llama3.2:1b"`
- See [OLLAMA_MODELS.md](OLLAMA_MODELS.md) for performance comparison

**More issues?** See [DEBUGGING.md](DEBUGGING.md)

## System Requirements

- **Docker Desktop** (Windows/Mac) or Docker Engine (Linux)
- **4GB RAM** minimum (8GB recommended)
- **2GB disk space** for base images + at least 2GB per model

## Next Steps

1. ✅ **Start the stack:** `docker compose up --build`
2. 📚 **Learn commands:** Read [QUICKSTART.md](QUICKSTART.md)
3. 🤔 **Choose a model:** See [OLLAMA_MODELS.md](OLLAMA_MODELS.md)
4. 🔧 **Customize:** Edit `index.html`, `app.js`, or `../AI-Server/server.py`
5. 🐛 **Debug issues:** Check [DEBUGGING.md](DEBUGGING.md)

## Architecture

```
┌─────────────────┐
│  Browser (8085) │  Chatbot UI
└────────┬────────┘
         │ /api/chat
┌────────▼────────────────────────┐
│     nginx Reverse Proxy          │
└────────┬──────────────────────────┘
         │ localhost:8000
┌────────▼──────────────────────────┐
│  AI-Server (Python)               │  Backend API
│  Routes messages to Ollama        │
└────────┬──────────────────────────┘
         │ /api/generate
┌────────▼──────────────────────────┐
│  Ollama (Port 11434)              │  Local LLM
│  Runs inference locally           │
└───────────────────────────────────┘
```

## Files Worth Exploring

- **[app.js](app.js)** — Frontend JavaScript (chat logic, API calls)
- **[index.html](index.html)** — UI markup
- **[styles.css](styles.css)** — Responsive styling
- **[../AI-Server/server.py](../AI-Server/server.py)** — Backend API
- **[docker-compose.yml](docker-compose.yml)** — Service orchestration
- **[nginx.conf](nginx.conf)** — Reverse proxy configuration

## Customization Ideas

- Add a **system prompt** in `../AI-Server/server.py`
- Modify **UI styling** in `styles.css`
- Change **quick prompts** in `index.html`
- Add **model switching** UI
- Implement **conversation history**
- Enable **GPU acceleration** in `docker-compose.yml`

See [README-PROJECT.md](README-PROJECT.md) for more ideas.

## Resources

- **Ollama Docs:** https://ollama.ai/docs
- **Model Library:** https://ollama.ai/library
- **Docker Compose:** https://docs.docker.com/compose/
- **Python HTTP Server:** https://docs.python.org/3/library/http.server.html

## License

Open source. Modify and distribute freely.

---

**Start chatting!** 🚀

```powershell
docker compose up --build
```

Then open http://127.0.0.1:8085
