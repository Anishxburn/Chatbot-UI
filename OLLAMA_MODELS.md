# Ollama Model Management

This guide explains how to configure and manage Ollama models in the chatbot stack.

## Quick Start

Change the model before starting the stack:

```powershell
$env:OLLAMA_MODEL="llama3.2:3b"
docker compose up --build
```

## Available Models

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `llama3.2:1b` | ~500MB | Very Fast | Basic | Quick testing, low resources |
| `llama3.2:3b` | ~2GB | Fast | Good | Balanced performance/quality |
| `llama3.2:7b` | ~4GB | Medium | Excellent | Best quality on consumer hardware |
| `llama3.2:11b` | ~7GB | Slow | Excellent | Large queries, complex reasoning |
| `mistral:7b` | ~4GB | Medium | Excellent | Code generation, creative writing |
| `neural-chat:7b` | ~4GB | Medium | Good | Chat-optimized |
| `orca-mini:3b` | ~2GB | Fast | Good | Instruction following |
| `phi:2.7b` | ~1.6GB | Very Fast | Decent | Lightweight, fast inference |

Full list: https://ollama.ai/library

## Configuration

### Setting the Model

Before starting Docker Compose, set the environment variable:

```powershell
# PowerShell
$env:OLLAMA_MODEL="llama3.2:7b"

# Or create .env file in Chatbot-UI directory
# OLLAMA_MODEL=llama3.2:7b
```

### Changing Models on Running Stack

If you want to change the model without rebuilding:

1. Stop the stack:
   ```powershell
   docker compose down
   ```

2. Update the environment variable and restart:
   ```powershell
   $env:OLLAMA_MODEL="mistral:7b"
   docker compose up
   ```

Note: The `ollama-init` service will automatically pull the new model when the stack starts.

## Persisting Models

Models are stored in a Docker volume named `ollama-data`. This means:

- Models persist between restarts ✓
- Models don't need to be re-downloaded when you change other configs ✓
- Models take up disk space in Docker's volume storage

To see the volume:

```powershell
docker volume ls | findstr ollama
docker volume inspect chatbot_ollama-data
```

To clear all models and free space:

```powershell
docker compose down -v
```

**Warning:** This removes all downloaded models. They'll be re-downloaded on next startup.

## Manual Model Management

If you want to manage models directly through Ollama:

### Pull a Model Manually

```powershell
# While the stack is running:
docker exec chatbot-ollama ollama pull llama3.2:7b

# Or access Ollama from another container:
docker compose exec ollama ollama pull neural-chat:7b
```

### List Downloaded Models

```powershell
curl http://127.0.0.1:11435/api/tags | jq .
```

### Remove a Model

```powershell
docker exec chatbot-ollama ollama rm llama3.2:1b
```

## Performance Tuning

### GPU Acceleration

If you have an NVIDIA GPU, Ollama can use it for faster inference:

```yaml
# In docker-compose.yml, add to ollama service:
services:
  ollama:
    runtime: nvidia
    environment:
      CUDA_VISIBLE_DEVICES: "0"
```

Then rebuild and restart.

### CPU Configuration

To limit CPU cores:

```yaml
services:
  ollama:
    environment:
      OLLAMA_NUM_THREAD: 4  # Use 4 CPU cores
```

### Memory Configuration

To prevent OOM on smaller models:

```yaml
services:
  ollama:
    environment:
      OLLAMA_KEEP_ALIVE: 5m  # Unload model after 5 minutes of inactivity
```

## Troubleshooting

### Model Download Stuck or Failing

Check the ollama-init logs:

```powershell
docker compose logs ollama-init
```

If stuck, increase the timeout in `docker-compose.yml`:

```yaml
ollama-init:
  environment:
    OLLAMA_TIMEOUT: 300  # 5 minutes
```

### API Responds But Model Errors

Verify the model is actually installed:

```powershell
docker exec chatbot-ollama ollama list
```

If missing, pull it manually:

```powershell
$env:OLLAMA_MODEL="mistral:7b"
docker compose exec ollama ollama pull mistral:7b
```

### Service Timeout

Larger models need more time to respond. Adjust in `server.py`:

```python
# Line 67: increase timeout from 120 to 300 seconds for larger models
with urlopen(request, timeout=300) as response:
```

## Testing the Stack

### Health Check

```powershell
curl http://127.0.0.1:8085/api/health
```

### Direct Ollama API

```powershell
# List models
curl http://127.0.0.1:11435/api/tags

# Test a model
curl -X POST http://127.0.0.1:11435/api/generate `
  -H "Content-Type: application/json" `
  -d "{\"model\":\"llama3.2:1b\",\"prompt\":\"What is 2+2?\",\"stream\":false}"
```

### Through Chat API

```powershell
curl -X POST http://127.0.0.1:8085/api/chat `
  -H "Content-Type: application/json" `
  -d "{\"message\":\"What is 2+2?\"}"
```

## Recommended Setup

For most users:

- **Development**: `llama3.2:1b` or `llama3.2:3b` (fast iteration)
- **Production**: `llama3.2:7b` or `mistral:7b` (best quality)
- **Low Resources**: `phi:2.7b` (very fast, lightweight)

## Next Steps

- Modify the `chatbot-api` to add custom system prompts
- Build a custom web interface with more features
- Add model switching UI to the chat interface
- Integrate with multiple models for different tasks
