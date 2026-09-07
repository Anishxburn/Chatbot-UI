# Chatbot UI

Dependency-free browser client for `AI-Server` with a responsive chat layout, quick prompts, service status, and typing state.

## Run

Start `AI-Server` first:

```powershell
python ..\AI-Server\server.py
```

Then serve this folder so browser requests are allowed:

```powershell
python -m http.server 5500
```

Open `http://127.0.0.1:5500`. The UI calls `POST /api/chat` when served through Docker.

## Docker

From this folder:

```powershell
docker compose up --build
```

Open `http://127.0.0.1:8085`. Change the host port if needed:

```powershell
$env:CHATBOT_UI_PORT=8090
docker compose up --build
```

The Docker stack includes:

- `ollama` for local LLM inference
- `ollama-init` to pull the model
- `chatbot-api` for the Python API
- `chatbot-ui` for the Nginx-served website

The chatbot API is available through the UI proxy:

```powershell
curl http://127.0.0.1:8085/api/health
curl -X POST http://127.0.0.1:8085/api/chat -H "Content-Type: application/json" -d "{\"message\":\"What is energy?\"}"
```

Ollama is also exposed directly for testing:

```powershell
curl http://127.0.0.1:11435/api/tags
curl -X POST http://127.0.0.1:11435/api/generate -H "Content-Type: application/json" -d "{\"model\":\"llama3.2:1b\",\"prompt\":\"What is energy?\",\"stream\":false}"
```

The default model is `llama3.2:1b`. Change it before starting:

```powershell
$env:OLLAMA_MODEL="llama3.2:3b"
docker compose up --build
```
