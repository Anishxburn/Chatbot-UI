# Chatbot UI

Dependency-free browser client for `AI-Server` with a responsive chat layout, quick prompts, service status, and typing state. Powered by Ollama for local LLM inference.

## Quick Start with Docker

From this folder:

```powershell
docker compose up --build
```

Open `http://127.0.0.1:8085` and start chatting!

### Change Model or Port

```powershell
# Use a different model (llama3.2:3b, mistral:7b, etc.)
$env:OLLAMA_MODEL="llama3.2:3b"
docker compose up --build

# Use a different port
$env:CHATBOT_UI_PORT=8090
docker compose up --build

# Both
$env:OLLAMA_MODEL="mistral:7b"
$env:CHATBOT_UI_PORT=9000
docker compose up --build
```

See [OLLAMA_MODELS.md](../OLLAMA_MODELS.md) for available models and performance details.

## Local Development

Start `AI-Server` first:

```powershell
python ..\AI-Server\server.py
```

Then serve this folder:

```powershell
python -m http.server 5500
```

Open `http://127.0.0.1:5500`

## Architecture

The Docker stack includes:

- **ollama** — Local LLM inference engine
- **ollama-init** — Automatically pulls the configured model on startup
- **chatbot-api** — Python HTTP API that routes messages to Ollama
- **chatbot-ui** — Nginx-served responsive web interface

## API Reference

### Health Check

```powershell
curl http://127.0.0.1:8085/api/health
```

### Send a Message

```powershell
curl -X POST http://127.0.0.1:8085/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"What is energy?\"}"
```

### Debug Traces

View the last 25 requests and responses:

```powershell
curl http://127.0.0.1:8085/api/debug/traces | jq .
```

### Direct Ollama API (for testing)

```powershell
# List models
curl http://127.0.0.1:11435/api/tags

# Generate with a model
curl -X POST http://127.0.0.1:11435/api/generate `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"llama3.2:1b\",\"prompt\":\"What is energy?\",\"stream\":false}"
```

## Configuration

Copy `.env.example` to `.env` and customize:

```env
CHATBOT_UI_PORT=8085
OLLAMA_MODEL=llama3.2:1b
OLLAMA_HOST_PORT=11435
```

## Troubleshooting

**Chat not responding?**
- Check health: `curl http://127.0.0.1:8085/api/health`
- Check logs: `docker compose logs chatbot-api`
- Verify Ollama is ready: `docker compose logs ollama`

**Want a different model?**
- Stop the stack: `docker compose down`
- Change `$env:OLLAMA_MODEL` and restart: `docker compose up`
- See [OLLAMA_MODELS.md](../OLLAMA_MODELS.md) for recommendations

**Models taking too long?**
- Larger models are slower but higher quality
- See Performance Tuning in [OLLAMA_MODELS.md](../OLLAMA_MODELS.md)
