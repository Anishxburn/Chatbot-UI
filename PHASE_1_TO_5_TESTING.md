# AI Improvement Phases 1-5

This change implements the first five work items for MCP validation and answer observability:

1. **Tool test matrix:** an Excel workbook records expected versus actual MCP operation routing and answer quality.
2. **Trace details:** the debug view can show the selected operation, MCP request arguments, bounded MCP response sample, model answer, and final chart specs.
3. **Model comparison:** the configured `CHAT_MODEL` stays primary; optional comparison models run against the same deterministic MCP summary.
4. **Chart specification:** chart JSON continues to be generated from MCP values by the AI server, not invented by the LLM.
5. **Chart preview:** the protected trace dashboard renders compatible line, bar, and donut chart specs.

The AI server only records answer text in the in-memory trace when the debug dashboard is enabled and has a key. MCP payload snapshots require `DAXVIEW_MCP_DEBUG_RESPONSE=true` and are capped by `DAXVIEW_MCP_DEBUG_RESPONSE_LIMIT`.

## Local Git Workflow

Commit and push the two repositories separately because the compose build context points to the sibling `AI-Server` repository.

```powershell
cd C:\chatbot-stack\AI-Server
git add server.py
git commit -m "Add model comparison and chart trace details"
git push

cd C:\chatbot-stack\Chatbot-UI
git add docker-compose.yml .env.example MCP_Tool_Test_Matrix.xlsx scripts\create_mcp_tool_test_matrix.py PHASE_1_TO_5_TESTING.md
git commit -m "Add MCP test workbook and debug dashboard settings"
git push
```

## Dev Server Deployment

```bash
cd /opt/chatbot-stack/AI-Server
git pull

cd /opt/chatbot-stack/Chatbot-UI
git pull
```

Set or update the optional comparison and debug settings in `.env`. Keep the existing dashboard key unchanged:

```bash
cd /opt/chatbot-stack/Chatbot-UI
grep -q '^AI_COMPARE_MODEL_ENABLED=' .env && sed -i 's/^AI_COMPARE_MODEL_ENABLED=.*/AI_COMPARE_MODEL_ENABLED=true/' .env || echo 'AI_COMPARE_MODEL_ENABLED=true' >> .env
grep -q '^AI_COMPARE_MODELS=' .env && sed -i 's/^AI_COMPARE_MODELS=.*/AI_COMPARE_MODELS=qwen3:8b/' .env || echo 'AI_COMPARE_MODELS=qwen3:8b' >> .env
grep -q '^AI_COMPARE_MODEL_SHOW_TO_USER=' .env && sed -i 's/^AI_COMPARE_MODEL_SHOW_TO_USER=.*/AI_COMPARE_MODEL_SHOW_TO_USER=true/' .env || echo 'AI_COMPARE_MODEL_SHOW_TO_USER=true' >> .env
grep -q '^AI_DEBUG_DASHBOARD_ENABLED=' .env && sed -i 's/^AI_DEBUG_DASHBOARD_ENABLED=.*/AI_DEBUG_DASHBOARD_ENABLED=true/' .env || echo 'AI_DEBUG_DASHBOARD_ENABLED=true' >> .env
grep -q '^AI_CHARTS_ENABLED=' .env && sed -i 's/^AI_CHARTS_ENABLED=.*/AI_CHARTS_ENABLED=true/' .env || echo 'AI_CHARTS_ENABLED=true' >> .env
grep -q '^DAXVIEW_MCP_DEBUG_RESPONSE=' .env && sed -i 's/^DAXVIEW_MCP_DEBUG_RESPONSE=.*/DAXVIEW_MCP_DEBUG_RESPONSE=true/' .env || echo 'DAXVIEW_MCP_DEBUG_RESPONSE=true' >> .env
```

Pull the comparison model and rebuild both AI API containers:

```bash
docker compose exec ollama ollama pull qwen3:8b
docker compose up -d --build --force-recreate agent-poc-api chatbot-api
docker compose ps
docker compose logs --since=5m agent-poc-api | grep -i -E 'mcp_tool_request|mcp_tool_response|mcp_answer_refine|ai_final_response|error|timeout'
```

Open the trace dashboard at `http://<devaisvr-ip>:3030/debug/ai` (use the host port configured by `AGENT_POC_PORT`). Ask one question from the workbook, select its trace, and check that the actual operation, response data, configured primary model answer, Qwen3 answer, and chart preview match the request. A missing chart is valid when MCP returns no numeric series. Ensure the existing `AI_DEBUG_DASHBOARD_KEY` is present in `.env`; do not replace it with a blank value.

To compare DeepSeek instead, set `AI_COMPARE_MODELS=deepseek-r1:1.5b`, recreate the API containers, and keep the exact same question and selected site/time range. To run both alternatives in one turn, set `AI_COMPARE_MODELS=deepseek-r1:1.5b,qwen3:8b`; expect a longer response because comparison calls run sequentially.

## Regenerate the Workbook

```powershell
cd C:\chatbot-stack\Chatbot-UI
python scripts\create_mcp_tool_test_matrix.py
```

The workbook is `MCP_Tool_Test_Matrix.xlsx`. Verify exact operation names with the deployed MCP `tools/list`; the AI server allowlist and sample questions cannot confirm what the remote MCP deployment currently exposes.
