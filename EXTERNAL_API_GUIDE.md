# External API Access Guide

## 🎯 Quick Start for External Systems

Your local LLM is now **exposed and ready to use** from any system on your network.

---

## 📡 API Endpoint

```
Base URL: http://192.228.0.109:8085
Alternative: http://192.168.0.29:8085
```

### Main Chat Endpoint

```
POST http://192.228.0.109:8085/api/chat
```

---

## 📝 How to Call the API

### **1. Simple Request**

```json
POST http://192.228.0.109:8085/api/chat

Body:
{
  "message": "What is artificial intelligence?"
}

Response:
{
  "reply": "Artificial intelligence is...",
  "provider": "ollama",
  "model": "llama3.2:1b"
}
```

---

## 💻 Code Examples

### **Python**

```python
import requests

# Your local LLM API
url = "http://192.228.0.109:8085/api/chat"

# Ask a question
response = requests.post(
    url,
    json={"message": "What is machine learning?"},
    headers={"Content-Type": "application/json"}
)

# Get the answer
data = response.json()
print(f"Answer: {data['reply']}")
print(f"Model: {data['model']}")
print(f"Provider: {data['provider']}")
```

**Install requests:**
```bash
pip install requests
```

---

### **Node.js / JavaScript**

```javascript
const url = "http://192.228.0.109:8085/api/chat";

async function askLLM(message) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ message: message })
  });
  
  const data = await response.json();
  console.log("Answer:", data.reply);
  console.log("Model:", data.model);
  return data.reply;
}

// Usage
askLLM("What is Docker?");
```

---

### **cURL (Command Line)**

```bash
curl -X POST http://192.228.0.109:8085/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Explain quantum computing in simple terms"}'
```

---

### **PowerShell (Windows)**

```powershell
$url = "http://192.228.0.109:8085/api/chat"
$body = @{
    message = "What is cloud computing?"
} | ConvertTo-Json

$response = Invoke-WebRequest `
  -Uri $url `
  -Method POST `
  -ContentType "application/json" `
  -Body $body

$data = $response.Content | ConvertFrom-Json
Write-Host "Answer: $($data.reply)"
Write-Host "Model: $($data.model)"
```

---

### **Java**

```java
import java.net.URL;
import java.net.HttpURLConnection;
import java.io.OutputStream;
import java.util.Scanner;

public class LLMClient {
    public static void main(String[] args) throws Exception {
        String url = "http://192.228.0.109:8085/api/chat";
        String message = "{\"message\":\"What is Java?\"}";
        
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setRequestMethod("POST");
        conn.setRequestProperty("Content-Type", "application/json");
        conn.setDoOutput(true);
        
        try (OutputStream os = conn.getOutputStream()) {
            os.write(message.getBytes());
        }
        
        Scanner scanner = new Scanner(conn.getInputStream()).useDelimiter("\\A");
        String response = scanner.hasNext() ? scanner.next() : "";
        System.out.println(response);
    }
}
```

---

### **Go**

```go
package main

import (
    "bytes"
    "fmt"
    "io/ioutil"
    "net/http"
)

func main() {
    url := "http://192.228.0.109:8085/api/chat"
    message := []byte(`{"message":"What is Go programming?"}`)
    
    resp, err := http.Post(url, "application/json", bytes.NewBuffer(message))
    if err != nil {
        panic(err)
    }
    defer resp.Body.Close()
    
    body, _ := ioutil.ReadAll(resp.Body)
    fmt.Println(string(body))
}
```

---

### **PHP**

```php
<?php
$url = "http://192.228.0.109:8085/api/chat";
$message = json_encode(["message" => "What is PHP?"]);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_CUSTOMREQUEST, "POST");
curl_setopt($ch, CURLOPT_POSTFIELDS, $message);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, ["Content-Type: application/json"]);

$response = curl_exec($ch);
$data = json_decode($response, true);

echo "Answer: " . $data['reply'];
echo "Model: " . $data['model'];
?>
```

---

### **cURL in Bash Script**

```bash
#!/bin/bash

MESSAGE="$1"
URL="http://192.228.0.109:8085/api/chat"

response=$(curl -s -X POST "$URL" \
  -H "Content-Type: application/json" \
  -d "{\"message\":\"$MESSAGE\"}")

echo "Response: $response"

# Extract just the reply
reply=$(echo "$response" | grep -o '"reply":"[^"]*' | cut -d'"' -f4)
echo "Answer: $reply"
```

**Usage:**
```bash
./ask.sh "What is Linux?"
```

---

## ✅ Health Check

Before sending requests, verify the API is running:

```bash
curl http://192.228.0.109:8085/api/health

# Response should be:
# {"status": "ok", "service": "AI-Server"}
```

---

## 📊 Response Format

All responses follow this format:

```json
{
  "reply": "The AI's answer to your question",
  "provider": "ollama",
  "model": "llama3.2:1b"
}
```

**Fields:**
- `reply` — The generated answer
- `provider` — Always "ollama" (local inference)
- `model` — The model used (e.g., llama3.2:1b, mistral:7b)

---

## ⚙️ Current Configuration

| Setting | Value |
|---------|-------|
| **API URL** | http://192.228.0.109:8085/api/chat |
| **Alternative URL** | http://192.168.0.29:8085/api/chat |
| **Health Check** | http://192.228.0.109:8085/api/health |
| **Model** | llama3.2:1b (Fast, ~1-2 seconds per response) |
| **Provider** | Ollama (Local inference, no internet required) |

---

## ⚡ Response Times

Response time depends on the model:

| Model | Speed | Quality |
|-------|-------|---------|
| llama3.2:1b | 1-2s | Basic |
| llama3.2:3b | 5-8s | Good |
| llama3.2:7b | 15-25s | Excellent |
| mistral:7b | 20-30s | Excellent |

Current model: **llama3.2:1b** (fastest)

---

## 🔒 Important Notes

✅ **Local & Private**
- No internet required
- No data sent to cloud
- All processing happens locally
- No API keys needed

✅ **Performance**
- Response time varies by model and server load
- Larger requests may take longer
- CPU-based inference (can use GPU with proper setup)

⚠️ **Network Access**
- Only accessible from your local network
- Not available over the internet (by design)
- Make sure your server is not blocked by firewalls

---

## 🐛 Troubleshooting

### **"Connection refused" or "Cannot reach server"**

1. Check if server is running:
   ```bash
   curl http://192.228.0.109:8085/api/health
   ```

2. If that fails, ask your API owner to check:
   ```bash
   docker compose ps
   ```

3. Verify the IP address:
   - Try alternative: http://192.168.0.29:8085/api/chat
   - Ask the API owner for their IP

### **"Thinking... forever" (API responds but slow)**

- The model is processing your request
- Larger models (7b) take 15-30 seconds
- Just wait, it will respond
- Or ask the owner to use a faster model

### **Response is empty or error**

```json
{"error": "Ollama is not ready: ..."}
```

This means:
- Ollama service is still starting
- Model is still downloading
- Ask the owner to wait a minute and try again

### **Port already in use**

If you see port conflict errors, contact your API owner to change:
```
CHATBOT_UI_PORT=8090  # or another port
```

---

## 📚 Example Use Cases

### **1. Chatbot Integration**

```python
# Add LLM to your chatbot
def get_ai_response(user_message):
    response = requests.post(
        "http://192.228.0.109:8085/api/chat",
        json={"message": user_message}
    )
    return response.json()["reply"]
```

### **2. Batch Processing**

```python
# Process multiple questions
questions = [
    "What is AI?",
    "What is ML?",
    "What is DL?"
]

for q in questions:
    response = requests.post(
        "http://192.228.0.109:8085/api/chat",
        json={"message": q}
    )
    print(f"Q: {q}")
    print(f"A: {response.json()['reply']}\n")
```

### **3. Real-time Chat Application**

```javascript
// Real-time chat in web app
async function sendMessage(message) {
  const response = await fetch("http://192.228.0.109:8085/api/chat", {
    method: "POST",
    body: JSON.stringify({message}),
    headers: {"Content-Type": "application/json"}
  });
  
  const data = await response.json();
  displayMessage(data.reply, "assistant");
}
```

### **4. Data Analysis with LLM**

```python
# Analyze data summaries with LLM
def analyze_data(data_summary):
    response = requests.post(
        "http://192.228.0.109:8085/api/chat",
        json={"message": f"Analyze this data: {data_summary}"}
    )
    return response.json()["reply"]
```

---

## 🚀 Rate Limiting

Currently there's **no rate limiting**, so:
- ✅ Send as many requests as you want
- ⚠️ Be respectful of server resources
- 💡 Consider implementing your own rate limiting

---

## 📞 Support

If you encounter issues:

1. **Verify API is running:**
   ```bash
   curl http://192.228.0.109:8085/api/health
   ```

2. **Check API logs:**
   Ask your API owner to run:
   ```bash
   docker compose logs chatbot-api
   ```

3. **Test with cURL first:**
   Before implementing in your code, test with cURL to verify the API works

4. **Contact your API owner** with:
   - The error message
   - Your request payload
   - Screenshots of the issue

---

## 🔗 Additional Resources

- **API Owner:** Should have setup guide at `C:\chatbot-stack\Chatbot-UI\README.md`
- **Ollama Docs:** https://ollama.ai/docs
- **Chat API Docs:** See `C:\chatbot-stack\Chatbot-UI\README.md`
- **Debugging:** See `C:\chatbot-stack\Chatbot-UI\DEBUGGING.md`

---

## 📋 Quick Reference

```bash
# Health check
curl http://192.228.0.109:8085/api/health

# Ask a question
curl -X POST http://192.228.0.109:8085/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Your question here"}'

# Pretty print response
curl -s -X POST http://192.228.0.109:8085/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello"}' | jq '.'
```

---

**You're all set!** Start calling the API from your application. 🚀

For questions, contact your API owner (the person who set this up).
