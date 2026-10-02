# EMS prediction test

## What runs where

- DaxView still owns site selection, user scope, turn dispatch, and historical-data authorization.
- The AI Server selects `energy_forecast` for a forecast question. Its local prediction tool requests `site_energy_summary` through the existing DaxView data plan, then calls the authorized MCP tool with `bucket=day`.
- The prediction tool uses up to 35 complete daily readings. It estimates each future day from the last four readings for the same weekday, or the last seven readings if fewer than two weekday examples exist. It reports a seven-day backtest mean absolute error (MAE), data coverage, and the latest historical date.
- The answer model describes these calculated values; it does not produce the forecast numbers.
- The protected AI MCP Trace Dashboard has a Predictions tab that displays recent prediction runs, their source trace, method, coverage, backtest MAE, and chart.

The local prediction requires at least 21 complete daily readings, at least 80% daily coverage across the observed span, and a latest complete reading no older than two days. It excludes the current partial day. A rejection states which data requirement was not met.

## Existing MCP data contract

The first prediction test needs the existing `site_energy_summary` tool to accept authorized `site_id`, `start`, `end`, `timezone`, and `bucket=day`, and return daily rows under `buckets`, `rows`, `series`, or `data`. Each row needs a date (`date`, `timestamp`, `bucket`, or `start`) and a numeric energy value (`value` or `kwh`). Include `unit` (`kWh` recommended). The data plan must authorize this operation for the selected site and turn.

If DaxView later implements a dedicated MCP `energy_forecast` tool, agree on a separate contract before switching the AI Server to it: site and scope, forecast horizon, prediction dates and values, source window, unit, method/version, coverage, backtest error, and an explicit insufficient-data result. The current local tool does not assume that MCP operation exists.

## Deploy on devaisvr

Commit and push the reviewed changes from both local repos first. Then on the dev server:

```bash
cd /opt/chatbot-stack/AI-Server
git status --short
git pull --ff-only

cd /opt/chatbot-stack/Chatbot-UI
git status --short
git pull --ff-only
```

If either `git status --short` shows local edits that block a pull, inspect those edits before continuing. Do not discard the server's `.env`.

Enable chart previews and the protected dashboard in `/opt/chatbot-stack/Chatbot-UI/.env` if they are not already enabled. Keep the existing `AI_DEBUG_DASHBOARD_KEY` value. The AI Server reads `AI_REFINE_MCP_WITH_MODEL`, rather than `DAXVIEW_MCP_ANSWER_REFINE_ENABLED`.

```env
AI_DEBUG_DASHBOARD_ENABLED=true
AI_CHARTS_ENABLED=true
AI_REFINE_MCP_WITH_MODEL=true
```

```bash
cd /opt/chatbot-stack/Chatbot-UI
docker compose up -d --build --force-recreate agent-poc-api chatbot-api
docker compose ps
curl -i http://127.0.0.1:3030/health
docker compose exec agent-poc-api sh -lc 'echo AI_DEBUG_DASHBOARD_ENABLED=$AI_DEBUG_DASHBOARD_ENABLED AI_CHARTS_ENABLED=$AI_CHARTS_ENABLED AI_REFINE_MCP_WITH_MODEL=$AI_REFINE_MCP_WITH_MODEL'
docker compose logs --since=5m agent-poc-api
```

Open `http://<devaisvr-ip>:3030/debug/ai`. Read the existing dashboard key locally with `sed -n 's/^AI_DEBUG_DASHBOARD_KEY=//p' .env` and do not share it in logs or screenshots.

## Test questions

1. `What alarm types occurred most often at this site in the last 7 days? Rank the top five and show count, severity, and latest occurrence.` Expected operation: `alarm_frequency_summary`, limit 5. No energy tools or ISO appendix.
2. `Forecast this site's daily energy use for the next 7 days.` Expected selected operation: `energy_forecast`; source MCP request: `site_energy_summary`; local prediction event: `energy_prediction_completed`.
3. `Explain this result: what method and data coverage did you use for that forecast?` Ask in the same conversation. The answer should refer to the previous forecast and its actual trace. A missing previous turn should be stated, not fabricated.
4. `What about last month?` Ask after a site energy question. Expected: reuse the energy topic with last month's range.
5. `How does ISO 50001 use this site's energy data?` Expected: standards and library context are appropriate here.

On the Predictions tab, check that the values and dates agree with the chart and that MAE, coverage, and method are present. If no run appears, first check that a forecast turn reached `agent-poc-api` and that the dashboard key and trace settings are active. Trace data is held in memory and clears when the AI Server container restarts.

The code does not change the staging DaxView dispatcher. If turns remain accepted with zero dispatch attempts, repair or run the dispatcher on `stagingsvr` separately.
