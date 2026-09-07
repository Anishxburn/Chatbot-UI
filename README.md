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

Open `http://127.0.0.1:5500`. The UI calls `POST http://127.0.0.1:8000/chat`.

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
