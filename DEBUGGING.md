# Debugging Guide

Troubleshoot the chatbot stack with these tools and techniques.

## Health Checks

### Quick Status

```powershell
docker compose ps
```

Shows all running services and their health status.

### Service Health Endpoints

```powershell
# AI-Server health
curl http://127.0.0.1:8085/api/health

# Ollama health (direct)
curl http://127.0.0.1:11435/api/tags
```

### View Logs

```powershell
# All services
docker compose logs

# Specific service
docker compose logs chatbot-api
docker compose logs ollama
docker compose logs ollama-init

# Follow logs (real-time)
docker compose logs -f chatbot-api

# Last 50 lines
docker compose logs --tail 50
```

## Common Issues

### "Connection refused" on http://127.0.0.1:8085

**Check if Docker is running:**
```powershell
docker ps
# If no output, Docker Desktop isn't running
```

**Check if services are up:**
```powershell
docker compose ps
```

Should show all 4 services as `running` (status column).

**If chatbot-ui shows unhealthy:**
```powershell
docker compose logs chatbot-ui
```

Check for nginx errors. Usually means `chatbot-api` isn't responding.

---

### "Thinking..." never finishes

**Check Ollama status:**
```powershell
docker compose logs ollama-init
```

If still pulling model, wait. Download takes time.

**Manually verify Ollama is ready:**
```powershell
curl http://127.0.0.1:11435/api/tags -s | jq .
```

If empty `{"models": null}`, model hasn't been pulled yet.

**Check chatbot-api logs:**
```powershell
docker compose logs chatbot-api
```

Look for:
- `api_to_ollama_request` — Request sent
- `api_to_ollama_error` — Ollama call failed
- `api_from_ollama_response` — Got response back

---

### "Service Unavailable" or 503 Error

**Check if Ollama is running:**
```powershell
curl http://127.0.0.1:11435/api/tags
```

If no response, Ollama container crashed. Check logs:
```powershell
docker compose logs ollama
```

**Restart Ollama:**
```powershell
docker compose restart ollama
```

**Full restart:**
```powershell
docker compose down
docker compose up --build
```

---

### Responses are slow (10+ seconds)

**Check which model is running:**
```powershell
docker compose logs | grep OLLAMA_MODEL
```

Or:
```powershell
curl http://127.0.0.1:8085/api/debug/traces -s | jq '.traces[0].api_to_ui.model'
```

**Performance by model:**
- `llama3.2:1b` — ~1 second (fast, lower quality)
- `llama3.2:3b` — ~5 seconds (balanced)
- `llama3.2:7b` — ~15 seconds (best quality, slower)
- `mistral:7b` — ~20 seconds (creative, slower)

**Use a faster model:**
```powershell
docker compose down
$env:OLLAMA_MODEL = "llama3.2:1b"
docker compose up --build
```

See [OLLAMA_MODELS.md](OLLAMA_MODELS.md) for all options.

---

### High CPU Usage

**Normal during inference.** Larger models use more CPU.

**Check CPU in logs:**
```powershell
docker stats
```

Press Ctrl+C to exit.

**Reduce CPU usage:**
- Use smaller model (`llama3.2:1b`)
- Or buy more RAM for caching

---

### Out of Memory (OOM)

**Docker ran out of memory.**

**Check memory usage:**
```powershell
docker stats
```

**Increase Docker Desktop memory:**
1. Open Docker Desktop settings
2. Go to Resources → Memory
3. Increase allocation (try 8GB+)
4. Click Apply & Restart

**Or use a smaller model:**
```powershell
$env:OLLAMA_MODEL = "phi:2.7b"
docker compose down
docker compose up --build
```

---

### Disk Space Full

**Models and Docker images take space.**

**Check usage:**
```powershell
docker system df
```

**Free up space:**
```powershell
# Remove unused images
docker image prune

# Remove containers
docker container prune

# Remove volumes (deletes cached models!)
docker volume prune

# Nuclear option
docker system prune -a --volumes
```

---

## API Testing

### Test the Full Stack

```powershell
# 1. Health check
curl http://127.0.0.1:8085/api/health
# {"status": "ok", "service": "AI-Server"}

# 2. Send a message
curl -X POST http://127.0.0.1:8085/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"What is 2+2?\"}"

# 3. View traces
curl http://127.0.0.1:8085/api/debug/traces | jq '.traces[0]'
```

### Trace Format

Each trace includes:

```json
{
  "request_id": "uuid",
  "client": "127.0.0.1",
  "request_path": "/chat",
  "ui_to_api": {
    "method": "POST",
    "body": { "message": "..." }
  },
  "api_to_ollama": {
    "url": "http://ollama:11434/api/generate",
    "model": "llama3.2:1b",
    "stream": false
  },
  "status": "ok",
  "api_to_ui": {
    "provider": "ollama",
    "model": "llama3.2:1b",
    "reply_preview": "..."
  },
  "duration_ms": 2345
}
```

**Useful fields:**
- `duration_ms` — Total request time
- `status` — "ok" or "error"
- `api_to_ollama.url` — Verify Ollama endpoint
- `api_to_ui.model` — Verify correct model used

---

## Low-Level Debugging

### Direct Ollama API

```powershell
# List models
curl http://127.0.0.1:11435/api/tags | jq '.models[] | {name, size}'

# Test inference
curl -X POST http://127.0.0.1:11435/api/generate `
  -H "Content-Type: application/json" `
  -d "{
    \"model\": \"llama3.2:1b\",
    \"prompt\": \"What is energy?\",
    \"stream\": false
  }" | jq '.response'

# Check model details
curl http://127.0.0.1:11435/api/show `
  -H "Content-Type: application/json" `
  -d "{\"name\": \"llama3.2:1b\"}" | jq '.details'
```

### Container Shell Access

```powershell
# Run command in container
docker compose exec chatbot-api python -c "import sys; print(sys.version)"

# Interactive shell in Ollama
docker compose exec ollama ollama list

# Pull a model manually
docker compose exec ollama ollama pull mistral:7b

# Check Python environment
docker compose exec chatbot-api python -c "
import os
print('OLLAMA_URL:', os.getenv('OLLAMA_URL'))
print('OLLAMA_MODEL:', os.getenv('OLLAMA_MODEL'))
"
```

### Docker Network

```powershell
# Inspect network
docker network ls
docker network inspect chatbot-ui_default

# Services can reach each other:
# - chatbot-ui → chatbot-api at http://chatbot-api:8000
# - chatbot-api → ollama at http://ollama:11434
```

---

## Container Lifecycle

### View Container IDs

```powershell
docker compose ps
```

### Restart a Service

```powershell
docker compose restart chatbot-api
docker compose restart ollama
```

### Rebuild a Service

```powershell
docker compose up --build chatbot-api
```

### Stop Everything

```powershell
docker compose down
```

### Remove Everything (including volumes)

```powershell
docker compose down -v
```

---

## Performance Analysis

### Measure Response Time

```powershell
$start = Get-Date
curl -X POST http://127.0.0.1:8085/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"Hello\"}" | Out-Null
$duration = (Get-Date) - $start
Write-Host "Duration: $($duration.TotalMilliseconds)ms"
```

### Check Container Resource Usage

```powershell
docker stats --no-stream
```

Shows:
- CPU % usage
- Memory usage
- Network I/O
- Block I/O

### Measure Model Download Speed

```powershell
# Monitor ollama-init logs
docker compose logs -f ollama-init

# It shows:
# - Pull progress (%)
# - Time elapsed
# - Speed (MB/s)
```

---

## Environment Variables Reference

Set these before `docker compose up`:

```powershell
# Model to use
$env:OLLAMA_MODEL = "llama3.2:3b"

# UI port
$env:CHATBOT_UI_PORT = 8085

# Ollama port (exposed to host)
$env:OLLAMA_HOST_PORT = 11435

# These are set in docker-compose.yml:
# CHATBOT_HOST = 0.0.0.0
# CHATBOT_PORT = 8000
# CHATBOT_ALLOWED_ORIGINS = http://localhost:8085,http://127.0.0.1:8085
# OLLAMA_URL = http://ollama:11434 (internal)
```

---

## Getting Help

### Collect Debug Info

```powershell
# 1. Status
docker compose ps > debug.txt

# 2. Logs (last 100 lines)
docker compose logs --tail 100 >> debug.txt

# 3. System info
docker system df >> debug.txt

# 4. Network
docker network inspect chatbot-ui_default >> debug.txt
```

Then share `debug.txt` and your steps to reproduce.

### Check Official Docs

- **Ollama:** https://ollama.ai/docs
- **Docker:** https://docs.docker.com/compose/
- **Python HTTP:** https://docs.python.org/3/library/http.server.html

---

## Quick Reference

| Issue | Command | What It Does |
|-------|---------|--------------|
| Service stuck | `docker compose restart ollama` | Restart one service |
| All stuck | `docker compose down && docker compose up --build` | Full restart |
| Can't connect | `docker compose ps` | Check services running |
| Slow responses | `docker compose logs -f chatbot-api` | Watch what's happening |
| Out of space | `docker system prune -a --volumes` | Delete everything unused |
| Check health | `curl http://127.0.0.1:8085/api/health` | Is API responding? |
| View traces | `curl http://127.0.0.1:8085/api/debug/traces \| jq` | See last 25 requests |
| Change model | `$env:OLLAMA_MODEL="mistral:7b"` | Set model before up |
