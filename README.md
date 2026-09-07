# Chatbot-UI

Chatbot UI

Dependency-free browser client for `AI-Server`.

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
