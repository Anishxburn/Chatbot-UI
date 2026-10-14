# AI Server to frontend data contract

This note describes the DaxView integration path implemented by the AI Server. It focuses on the chat message and its structured report, chart, and table data.

## Request and response flow

1. The frontend creates a conversation with `POST /v1/integrations/daxview/conversations`. The response includes `conversation_id`.
2. It submits a user turn to `POST /v1/integrations/daxview/conversations/{conversation_id}/turns` with `turn_id`, `message`, optional `request_id`, and optional `context`. The server returns `202` and `job_id`.
3. The frontend polls `GET /v1/integrations/daxview/jobs/{job_id}/events?after={event_id}`. The response is `{ "events": [{ "id": 1, "type": "message", "data": { ... } }] }`.
4. A successful answer arrives as a `message` event, followed by `completed`. A message event's `data` carries the display text and any structured visual data. Other event types include `status`, `waiting_for_user`, and `failed`.

The integration routes are authenticated and scoped to the authorized deployment, company, and user. The frontend should use its normal authenticated API client and must not expose credentials or authorization grants in the message body.

### Clarifying an ambiguous device name

When a telemetry question contains an exact authorized device name, the AI
Server resolves that name directly, even if another device has a similar name.
When the supplied name is only a partial match and multiple devices are equally
plausible, the server sends a normal `message` event with the candidate device
names and asks the user to reply with the intended name. The conversation keeps
the original metric, site, and time range for that reply. Device ambiguity is
not sent as `waiting_for_user`: that event currently supports the site,
building, and time-range context fields, and a device selector would otherwise
render as an empty form in clients that do not implement device choices.

### Clarifying broad historical-reading requests

For a request such as “I need historical device readings at this site,” the
server asks in a normal `message` event for any missing metric and period. It
does not fetch data or silently assume energy or the default seven-day range.
The next user reply can provide either or both details; the conversation keeps
the site and previously supplied detail. For site-wide energy, it then queries
the site energy summary. For a per-device metric such as voltage or current,
it asks for a device name before fetching. The user can answer in plain text;
the UI does not need a metric selector or a custom clarification form.

## Message payload

The server emits a message event in this shape (optional fields are omitted when there is no corresponding data):

```json
{
  "text": "Site energy use increased on October 10.",
  "charts": [
    {
      "type": "line",
      "title": "Daily Site Energy",
      "labels": ["2026-10-07", "2026-10-08"],
      "summary": "Daily site energy changed slightly over the requested period.",
      "series": [{ "name": "Energy", "unit": "kWh", "data": [17651039.03, 17539567.70] }]
    }
  ],
  "tables": [
    {
      "title": "Site Energy by Period",
      "columns": [
        { "key": "period", "label": "Period" },
        { "key": "value", "label": "Energy" },
        { "key": "unit", "label": "Unit" }
      ],
      "rows": [
        { "period": "2026-10-07", "value": 17651039.03, "unit": "kWh" }
      ],
      "row_count": 7,
      "truncated": false,
      "source_tool": "site_summary.energy",
      "operation": "site_energy_summary",
      "time_range": { "start_time": "2026-10-07", "end_time": "2026-10-13", "timezone": "Asia/Kuala_Lumpur" }
    }
  ],
  "presentation": {
    "type": "site_summary",
    "show_chart": true,
    "show_table": true,
    "sections": ["Site Energy by Period"]
  }
}
```

### What each field is for

- `text`: user-facing answer. The UI should render it as readable text/Markdown with clear paragraph spacing.
- `charts`: chart specifications made from returned numeric data. `labels` align by index with each series' `data`; `unit` describes values. Do not infer chart values from the prose answer.
- `charts[].summary` (optional): a short, data-grounded explanation of the plotted series. Time-series labels are formatted for the requested/site timezone; the answer or chart summary states the full period and timezone.
- `tables`: tabular data. `columns` define display order and labels; each row is an object keyed by each column's `key`. Render a cell from `row[column.key]`, preserving numeric zero. Show a clear placeholder for null/missing fields.
- `presentation`: display classification and suggested sections. It helps the UI choose a presentation; it does not replace `text`, `charts`, or `tables`.
- `row_count` is the source count where supplied; the visible `rows` list may be capped. `truncated` indicates source truncation.

## Reports

In this integration path, a “report” is currently the composed chat answer plus its `presentation` classification and any `charts`/`tables`. The message contract does not itself promise a downloadable PDF, spreadsheet, or document. The debug trace may additionally include internal `report_data` when a report builder provides it; treat that as diagnostic metadata unless a dedicated report API is added.

## How the AI Server produces these values

- The planner selects operations and sanitized arguments; the MCP tool response supplies the underlying data.
- The answer summary is generated from tool results. Depending on configuration, it may be deterministic or refined by the configured model.
- `build_charts_from_historical_results` constructs chart specs from returned values; chart series are aligned to their labels.
- `build_tables_from_historical_results` maps supported operation results to table columns and rows. The LLM should not invent table values.
- `answer_presentation` classifies the answer (for example `site_summary`, `ranking`, `alarm_summary`, or `trend`) and sets chart/table hints.

## Debugging the blank table preview

The debug dashboard's `ai_outcome_debug` trace records `answer`, `charts`, `tables`, `generation`, and `charts_enabled`. Expand **Generation details** to inspect the operation arguments, chart specs, table objects, and report classification. Beneath a table, **Raw row data** prints the first five records without column mapping, and **Inspect raw table payload** shows its columns, sample rows, and row count.

If a table says `7 shown of 7` but its cells are blank, compare the raw rows to the column keys. The expected pairing is, for example, `columns: [{"key":"period"}, {"key":"value"}]` with rows like `{ "period":"2026-10-07", "value":17651039.03 }`. If the raw rows contain values while the visible table is blank, reload/rebuild the AI Server; the debug dashboard is embedded in its server image. In this repository's compose setup, source is not mounted into the API container, so rebuild and recreate it after changing `server.py`:

```powershell
docker compose build chatbot-api
docker compose up -d --force-recreate chatbot-api
```

The compose default sets `AI_CHARTS_ENABLED=false`; enable it in the environment if chart generation is part of the test.

## Simple debug-server prompts

Run these against a site with matching telemetry/alarm data, then inspect the corresponding trace in the debug dashboard:

1. **Chart:** “Show daily site energy for the last 7 days as a chart.”
2. **Table:** “List active alarms for this site in a table.”
3. **Report:** “Give me a short site energy and active alarm report for the last 7 days.”

The exact number of rows and whether a chart can be built depend on the MCP data returned for the selected site and period. If a prompt asks for a chart but none is emitted, check `charts_enabled`, the selected operation, and whether its result contains numeric time-series values.
