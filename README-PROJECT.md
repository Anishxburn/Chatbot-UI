# Chatbot Stack

A complete, self-contained local AI chatbot built with:

- **Frontend:** Responsive vanilla JavaScript web UI
- **Backend:** Python HTTP API
- **LLM:** Ollama (runs models locally)
- **Infrastructure:** Docker Compose (all services containerized)

No API keys. No cloud. No data leaving your machine. Everything runs locally.

## Quick Start

```powershell
cd Chatbot-UI
docker compose up --build
```

Open **http://127.0.0.1:8085** and start chatting!

👉 See [QUICKSTART.md](QUICKSTART.md) for detailed walkthrough.

## Repository Structure

```
chatbot-stack/
├── Chatbot-UI/                 # Frontend + Docker Compose config
│   ├── docker-compose.yml      # Complete service orchestration
│   ├── Dockerfile              # nginx web server
│   ├── index.html              # UI markup
│   ├── app.js                  # Frontend logic
│   ├── styles.css              # Responsive styling
│   ├── nginx.conf              # API proxy config
│   └── README.md               # Frontend docs
│
├── AI-Server/                  # Backend API
│   ├── server.py               # HTTP API server
│   ├── Dockerfile              # Python runtime
│   └── README.md               # Backend docs
│
├── QUICKSTART.md               # 30-second setup guide
├── OLLAMA_MODELS.md            # Model selection & management
└── README.md                   # This file
```

## Features

- ✅ **Completely Local** — Ollama runs inference on your machine
- ✅ **No API Keys** — No third-party dependencies
- ✅ **Privacy** — All data stays on your device
- ✅ **Fast Setup** — One command to start
- ✅ **Extensible** — Easy to customize and modify
- ✅ **Debuggable** — Request traces and logs included
- ✅ **Model Switching** — Easy model selection and management

## What Gets Downloaded?

On first startup, Docker will download and cache:

1. **Base images** (~2-3GB)
   - Python 3.12 slim
   - nginx 1.27 Alpine
   - Ollama

2. **AI models** (depends on choice)
   - `llama3.2:1b` (~500MB) — default, fast
   - `llama3.2:3b` (~2GB) — balanced
   - `llama3.2:7b` (~4GB) — best quality

Models persist in Docker volumes after download, so subsequent starts are instant.

## Docker Services

| Service | Image | Role |
|---------|-------|------|
| ollama | ollama/ollama | LLM inference engine |
| ollama-init | ollama/ollama | Model bootstrapper (one-shot) |
| chatbot-api | python:3.12-slim | Backend API server |
| chatbot-ui | nginx:1.27-alpine | Frontend web server |

All services communicate through Docker's internal network. Only port 8085 (UI) and 11435 (Ollama, for testing) are exposed to your machine.

## API Reference

### Health Check

```bash
curl http://127.0.0.1:8085/api/health
# {"status": "ok", "service": "AI-Server"}
```

### Chat Endpoint

```bash
curl -X POST http://127.0.0.1:8085/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What is energy?"}'

# {"reply": "Energy is...", "provider": "ollama", "model": "llama3.2:1b"}
```

### Debug Traces

```bash
curl http://127.0.0.1:8085/api/debug/traces | jq '.traces[0]'
```

Returns the last 25 requests with timing, models, and error info.

## Configuration

Edit environment variables before running:

```powershell
# Different model (see OLLAMA_MODELS.md for options)
$env:OLLAMA_MODEL = "mistral:7b"

# Different ports
$env:CHATBOT_UI_PORT = 8090
$env:OLLAMA_HOST_PORT = 11436

# Then start
docker compose up --build
```

Or create a `.env` file in `Chatbot-UI/`:

```env
OLLAMA_MODEL=mistral:7b
CHATBOT_UI_PORT=8090
OLLAMA_HOST_PORT=11436
```

## Development

### Local Setup (No Docker)

**Backend:**
```powershell
cd AI-Server
python server.py
# Listens on http://127.0.0.1:8000
```

**Frontend:**
```powershell
cd Chatbot-UI
python -m http.server 5500
# Open http://127.0.0.1:5500
```

### Docker Development

```powershell
# Rebuild and restart
docker compose up --build

# Watch logs
docker compose logs -f

# Rebuild specific service
docker compose up --build chatbot-api

# Run commands in container
docker compose exec chatbot-api python -c "print('hello')"
```

## Customization Ideas

### Backend
- Add a **system prompt** in `server.py` to customize behavior
- Implement **streaming responses** for faster perceived UX
- Add **multi-model support** with model switching
- Integrate **embeddings** for semantic search
- Add **conversation history** with persistent storage

### Frontend
- Add **conversation export** (save chats as JSON/Markdown)
- Implement **chat history** (store sessions)
- Add **model selector** UI
- Show **token count** and **latency**
- Add **voice input/output** integration
- Custom **UI themes**

### Infrastructure
- Configure **GPU acceleration** (NVIDIA CUDA)
- Set up **persistent chat storage**
- Add **rate limiting**
- Implement **authentication**
- Deploy on **kubernetes** for multi-user

## Troubleshooting

**Port already in use?**
```powershell
$env:CHATBOT_UI_PORT = 8090
docker compose up --build
```

**Ollama still downloading model?**
```powershell
docker compose logs ollama-init
```

**API not responding?**
```powershell
curl http://127.0.0.1:8085/api/health
docker compose logs chatbot-api
```

**Want to switch models?**
```powershell
docker compose down
$env:OLLAMA_MODEL = "mistral:7b"
docker compose up --build
```

**Free up disk space?**
```powershell
docker compose down -v  # Remove models
docker image prune      # Remove unused images
docker system prune      # Full cleanup
```

## Performance Tips

| Metric | Fast Model | Balanced | Best Quality |
|--------|-----------|----------|--------------|
| Model Size | 500MB | 2GB | 4GB+ |
| First Response | ~1s | ~5s | ~15s |
| Recommended RAM | 2GB | 4GB | 8GB+ |
| Example Models | llama3.2:1b | llama3.2:3b | mistral:7b |

**Slow responses?**
- Use a smaller model (faster but less capable)
- Or wait (quality is worth it!)

**Low disk space?**
- Remove old models: `docker compose down -v`
- Or keep the current model cached

**High CPU usage?**
- Normal during inference
- Larger models use more CPU

See [OLLAMA_MODELS.md](OLLAMA_MODELS.md) for detailed model info.

## Learning Resources

- **Ollama Docs:** https://ollama.ai
- **Model Library:** https://ollama.ai/library
- **Docker Docs:** https://docs.docker.com
- **Python HTTP Server:** https://docs.python.org/3/library/http.server.html

## Files You Might Want to Edit

1. **Add a system prompt:** `AI-Server/server.py` (line ~42)
2. **Change UI text:** `Chatbot-UI/index.html`
3. **Modify styling:** `Chatbot-UI/styles.css`
4. **Adjust API behavior:** `AI-Server/server.py` (ask_ollama function)
5. **Change quick prompts:** `Chatbot-UI/index.html` (section.panel, class="prompt-list")

## License

This project is open source. Feel free to modify and distribute.

## Next Steps

1. ✅ Start the stack: See [QUICKSTART.md](QUICKSTART.md)
2. 📚 Explore models: See [OLLAMA_MODELS.md](OLLAMA_MODELS.md)
3. 🔧 Customize: Edit frontend/backend files
4. 📈 Extend: Add features and integrate with other tools

Happy chatting! 🚀
