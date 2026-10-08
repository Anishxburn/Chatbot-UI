# EMS MCP Simplified Tool Specification

## Purpose

This document is a developer handoff for rebuilding the DaxView MCP tool surface around the original integration protocol, but with a smaller EMS-focused tool set.

The chatbot must be able to answer practical EMS questions with actual values, not only metadata. The priority is device telemetry values such as kWh, voltage, current, power, demand, and enough raw data for the AI Server to calculate rankings and max/peak demand.

## Keep The Original Integration Protocol

The MCP flow should stay the same as the original DaxView AI integration design:

1. The AI Server receives a user question.
2. The AI Server selects one MCP operation.
3. The AI Server calls the DaxView data-plan/authorization endpoint with the intended operation and arguments.
4. DaxView returns:
   - `authorization_id`
   - normalized arguments
5. The AI Server calls MCP `tools/call` using:
   - the returned `authorization_id`
   - the exact normalized arguments returned by the data-plan response
6. MCP validates and executes the read-only query.
7. MCP returns structured JSON values to the AI Server.

Important rule:

The MCP call must use the exact normalized arguments returned by the data-plan response. Do not add, remove, default, rename, or remap fields after authorization.

## Token And Credential Rules

Keep these credentials separate:

| Credential | Used By | Purpose |
|---|---|---|
| `DAXVIEW_MCP_AUTH_TOKEN` on AI Server | AI Server -> MCP | Bearer token for calling `/mcp`. Must match DaxView MCP `DAXVIEW_MCP_API_KEY`. |
| `DAXVIEW_MCP_API_KEY` on MCP | MCP | Validates AI Server calls to MCP. |
| `DAXVIEW_AI_GATEWAY_TOKEN` on MCP and Django | MCP -> Django | Internal service credential. Must match between MCP and Django. AI Server must not store this. |
| AI callback key / server API key | DaxView <-> AI Server | Existing callback authentication. Keep as-is from the original integration. |

Do not paste real tokens into tickets. Compare only token length and short hash when debugging.

Example safe check:

```bash
python - <<'PY'
import os, hashlib
for k in ("DAXVIEW_MCP_API_KEY", "DAXVIEW_AI_GATEWAY_TOKEN"):
    v = os.getenv(k) or ""
    h = hashlib.sha256(v.encode()).hexdigest()[:12] if v else ""
    print(k, "len=", len(v), "hash=", h)
PY
```

## Current Problem To Avoid

The current system has produced errors such as:

- `401 Unauthorized`
- `AUTHORIZATION_DENIED`
- `UNSUPPORTED_METRIC`
- `BACKEND_UNAVAILABLE`
- metadata returned but no numeric value

The new MCP implementation should make these impossible to confuse:

- `401 Unauthorized` means the AI -> MCP bearer token is wrong or missing.
- `AUTHORIZATION_DENIED` means the authorization operation/arguments do not match the MCP call.
- `UNSUPPORTED_METRIC` means the requested metric does not exist for that device/site.
- `NO_DATA` means the metric is supported but no rows exist in the requested time range.
- `BACKEND_UNAVAILABLE` means DaxView backend failed or timed out.

## Recommended OG 5 EMS Tools

Keep the tool surface small and value-focused.

### 1. `site_metadata_summary`

Purpose:

Return the current site/building/device/meter summary.

Use for:

- "What site am I viewing?"
- "How many devices are in this site?"
- "Show site id, site name, building count, device count."

Arguments:

```json
{
  "authorization_id": "string",
  "site_id": 17,
  "timezone": "Asia/Kuala_Lumpur"
}
```

Response data:

```json
{
  "site": {
    "site_id": 17,
    "site_name": "Mun Hean Singapore (HQ)",
    "timezone": "Asia/Kuala_Lumpur"
  },
  "counts": {
    "building_count": 1,
    "device_count": 25,
    "meter_count": 10,
    "online_count": 8,
    "offline_count": 17
  }
}
```

### 2. `site_device_list`

Purpose:

Return device inventory and status. This is not for historical values; it tells the AI what devices exist.

Use for:

- "List all devices."
- "Which devices are offline?"
- "Which device IDs are available?"

Arguments:

```json
{
  "authorization_id": "string",
  "site_id": 17,
  "building_id": null,
  "timezone": "Asia/Kuala_Lumpur",
  "limit": 500
}
```

Response data:

```json
{
  "site_id": 17,
  "devices": [
    {
      "device_id": 519,
      "device_name": "AC kWh",
      "device_type": "virtual",
      "building_id": null,
      "building_name": null,
      "status": "online",
      "data_status": "fresh",
      "last_seen": "2026-10-08T01:00:00+00:00",
      "expected_interval_seconds": 300,
      "manufacturer": null,
      "meter_model": null
    }
  ],
  "device_count": 1,
  "truncated": false
}
```

### 3. `device_metric_catalog`

Purpose:

Tell the AI exactly which metrics exist for each device before asking for values.

This is the most important discovery tool. It prevents the chatbot from asking for voltage/current/demand when a device only has kWh.

Use for:

- "What telemetry metrics are available?"
- "Which devices have voltage?"
- "Which devices have kWh, current, power, or demand?"

Arguments:

```json
{
  "authorization_id": "string",
  "site_id": 17,
  "building_id": null,
  "device_id": null,
  "start_time": "2026-10-01T00:00:00+00:00",
  "end_time": "2026-10-08T00:00:00+00:00",
  "timezone": "Asia/Kuala_Lumpur",
  "limit": 500
}
```

Response data:

```json
{
  "site_id": 17,
  "devices": [
    {
      "device_id": 519,
      "device_name": "AC kWh",
      "device_type": "virtual",
      "available_metrics": [
        {
          "metric": "energy",
          "canonical_metric": "kwh",
          "source_metric": "kWh",
          "unit": "kWh",
          "phase": "all",
          "available": true,
          "first_timestamp": "2026-10-01T00:00:00+00:00",
          "last_timestamp": "2026-10-08T00:00:00+00:00",
          "sample_count": 2016,
          "coverage_percent": 100.0,
          "expected_interval_seconds": 300
        }
      ]
    }
  ],
  "device_count": 1,
  "metric_count": 1,
  "truncated": false
}
```

Required supported metric names:

| User Meaning | Canonical Metric | Common Source Names |
|---|---|---|
| Energy consumption | `energy` or `kwh` | `kWh`, `energy_kwh`, `import_kwh` |
| Voltage | `voltage` | `V`, `Voltage`, `VLN`, `VLL`, `L1_V`, `L2_V`, `L3_V` |
| Current | `current` | `A`, `Current`, `I`, `L1_A`, `L2_A`, `L3_A` |
| Active power | `power` or `kw` | `kW`, `P`, `active_power` |
| Demand | `demand` | `kW demand`, `max_demand`, `demand_kw` |
| Power factor | `power_factor` | `PF`, `cos_phi` |
| Frequency | `frequency` | `Hz`, `freq` |
| THD | `thd` | `THD`, `THDv`, `THDi` |

### 4. `device_telemetry_timeseries`

Purpose:

Return actual numeric telemetry values for devices and metrics. This should be the main value tool.

Use for:

- "What is the kWh for device 519 last 7 days?"
- "Show voltage for device 380 last 24 hours."
- "Show current and power for this meter today."
- "Give data points so AI Server can calculate peak demand."

Arguments:

```json
{
  "authorization_id": "string",
  "site_id": 17,
  "building_id": null,
  "device_id": 519,
  "metric": "energy",
  "phase": "all",
  "start_time": "2026-10-01T00:00:00+00:00",
  "end_time": "2026-10-08T00:00:00+00:00",
  "timezone": "Asia/Kuala_Lumpur",
  "bucket": "1d",
  "aggregation": "auto",
  "value_mode": "auto",
  "limit": 500
}
```

Response data:

```json
{
  "site_id": 17,
  "device_id": 519,
  "device_name": "AC kWh",
  "metric": "energy",
  "canonical_metric": "kwh",
  "source_metric": "kWh",
  "unit": "kWh",
  "phase": "all",
  "bucket": "1d",
  "aggregation": "sum",
  "value_mode": "delta",
  "points": [
    {
      "timestamp": "2026-10-01T00:00:00+00:00",
      "value": 123.45,
      "unit": "kWh",
      "quality": "good"
    }
  ],
  "summary": {
    "count": 7,
    "min": 100.1,
    "max": 150.2,
    "avg": 126.4,
    "sum": 884.8,
    "first_timestamp": "2026-10-01T00:00:00+00:00",
    "last_timestamp": "2026-10-08T00:00:00+00:00"
  }
}
```

Notes:

- This tool must return `value`, `unit`, `timestamp`, `metric`, and `source_metric`.
- If metric is cumulative kWh, return consumption delta when `value_mode` is `auto` or `delta`.
- If metric is instantaneous voltage/current/power, return aggregated sample values based on `bucket` and `aggregation`.
- `phase` must be normalized consistently before authorization and execution. Recommended default: `"all"`.
- `value_mode` must also be normalized consistently. Recommended default: `"auto"`.

### 5. `device_energy_ranking`

Purpose:

Rank devices by energy consumption for a site/building/time range.

Use for:

- "Top 5 devices by kWh last 7 days."
- "Which devices consumed the most energy today?"
- "Show top 10 consumers this month."

Arguments:

```json
{
  "authorization_id": "string",
  "site_id": 17,
  "building_id": null,
  "start_time": "2026-10-01T00:00:00+00:00",
  "end_time": "2026-10-08T00:00:00+00:00",
  "timezone": "Asia/Kuala_Lumpur",
  "metric": "energy",
  "limit": 10
}
```

Response data:

```json
{
  "site_id": 17,
  "metric": "energy",
  "unit": "kWh",
  "rankings": [
    {
      "rank": 1,
      "device_id": 519,
      "device_name": "AC kWh",
      "value": 884.8,
      "unit": "kWh",
      "source_metric": "kWh",
      "coverage_percent": 100.0
    }
  ],
  "device_count": 1,
  "calculation": "consumption_delta_over_time_range"
}
```

## Tools To Remove Or Deprioritize

Remove or disable from the chatbot-facing MCP surface for now:

| Tool | Reason |
|---|---|
| `energy_forecast` | Not needed for current EMS chatbot scope. |
| `anomaly_detection_summary` | Not needed until base values are stable. |
| `demand_peak_summary` | Remove as a standalone tool. Let AI Server calculate peak/max demand from telemetry values. |
| Broad report/forecast tools | They hide missing data and make debugging harder. |

Optional later:

| Tool | When To Add |
|---|---|
| `alarm_summary` | Add only if alarms are required in chatbot scope. |
| `power_quality_events` | Add after voltage/current/frequency/THD values are stable. |
| `data_availability_summary` | Useful for debugging missing metrics and coverage. |

## Should There Be One Tool To Pull All Data?

Do not create an unrestricted "get everything" tool.

It is technically possible, but it causes problems:

- Very large responses.
- Slow queries.
- Harder authorization.
- More risk of exposing data outside scope.
- AI model may ignore or truncate important values.
- Debugging becomes unclear.

Recommended compromise:

Create one broad but bounded value tool: `device_telemetry_timeseries`.

It may support:

- one device + one metric
- one device + multiple metrics
- multiple devices + one metric
- site/building-level query with strict `limit`

But it must always require:

- authorized site scope
- time range
- metric list
- limit
- stable structured output

## Calculations The AI Server Should Do

The MCP should provide clean values. The AI Server can calculate:

| Question | Required MCP Data | AI Calculation |
|---|---|---|
| Total energy | kWh points or deltas | Sum kWh over range. |
| Top energy devices | kWh per device | Sort descending by kWh. |
| Max/peak demand | power/demand time-series | Max value and timestamp. |
| Average demand | power/demand time-series | Average value over range. |
| Load factor | average demand + peak demand | `avg_demand / peak_demand`. |
| Voltage min/max/avg | voltage time-series | Min, max, average by phase. |
| Current min/max/avg | current time-series | Min, max, average by phase. |
| Low power factor | PF time-series | Values below threshold. |
| Off-hours consumption | kWh points + schedule | Sum outside working hours. |
| Data coverage | sample counts/expected interval | Coverage percent and gaps. |
| Period comparison | two time ranges | Difference and percent change. |

For max demand, the preferred flow is:

1. Ask `device_metric_catalog` which devices have `power`, `kw`, or `demand`.
2. Call `device_telemetry_timeseries` for those devices and metrics.
3. Compute max value and timestamp in AI Server.
4. Return the source device and source metric.

## Common EMS Questions To Support

These questions should work after the new tool surface is implemented:

1. What site am I currently viewing? Show site id, site name, building count, device count, and meter count.
2. List all devices in this site with device id, name, type, status, and last seen.
3. Which devices are offline or stale?
4. What telemetry metrics are available for this site?
5. Which devices have kWh data?
6. Which devices have voltage data?
7. Which devices have current data?
8. Which devices have power or demand data?
9. What is the energy consumption for device ID 519 for the last 7 days? Show date, value, unit, and source metric.
10. Show daily kWh for device ID 519 for the last 7 days.
11. Show voltage trend for device ID 380 for the last 24 hours.
12. Show current trend for device ID 380 for the last 24 hours.
13. Show power trend for device ID 380 today.
14. Which top 5 devices consumed the most energy in the last 7 days?
15. Which top 10 devices consumed the most energy this month?
16. What is the max demand for this site today? Calculate from available power/demand telemetry and show timestamp and source device.
17. What was the highest power value for device ID 380 yesterday?
18. Compare this week's kWh with last week's kWh for device ID 519.
19. Which device has the worst power factor today?
20. Are there any data gaps for voltage/current/power in the last 24 hours?

## Standard Response Envelope

Every MCP tool should return this shape:

```json
{
  "status": "ok",
  "operation_id": "device_telemetry_timeseries",
  "read_only": true,
  "historical_only": true,
  "data": {},
  "metadata": {
    "site_id": 17,
    "building_id": null,
    "device_id": 519,
    "timezone": "Asia/Kuala_Lumpur",
    "start_time": "2026-10-01T00:00:00+00:00",
    "end_time": "2026-10-08T00:00:00+00:00",
    "source": "daxview_backend",
    "row_count": 7,
    "coverage_percent": 100.0,
    "generated_at": "2026-10-08T00:00:00+00:00"
  }
}
```

Error response:

```json
{
  "status": "error",
  "operation_id": "device_telemetry_timeseries",
  "read_only": true,
  "historical_only": true,
  "error_code": "NO_DATA",
  "message": "No telemetry rows exist for the requested device, metric, and time range.",
  "metadata": {
    "site_id": 17,
    "device_id": 519,
    "metric": "voltage",
    "start_time": "2026-10-01T00:00:00+00:00",
    "end_time": "2026-10-08T00:00:00+00:00",
    "timezone": "Asia/Kuala_Lumpur"
  }
}
```

Required stable error codes:

| Error Code | Meaning |
|---|---|
| `UNAUTHORIZED` | AI -> MCP bearer token is invalid or missing. |
| `AUTHORIZATION_DENIED` | `authorization_id` operation/arguments/scope mismatch. |
| `AUTHORIZATION_CONSUMED` | Single-use authorization was already used. |
| `VALIDATION_ERROR` | Missing or invalid argument. |
| `UNSUPPORTED_METRIC` | Metric is not supported for this device/site. |
| `NO_DATA` | Metric is valid but no rows exist for the requested range. |
| `LIMIT_EXCEEDED` | Requested response is too large. |
| `BACKEND_UNAVAILABLE` | DaxView backend failed or timed out. |

## Authorization Normalization Rules

These fields must be normalized identically in the data-plan path and MCP execution path:

```json
{
  "site_id": 17,
  "building_id": null,
  "device_id": 519,
  "metric": "energy",
  "phase": "all",
  "start_time": "2026-10-01T00:00:00+00:00",
  "end_time": "2026-10-08T00:00:00+00:00",
  "timezone": "Asia/Kuala_Lumpur",
  "bucket": "1d",
  "aggregation": "auto",
  "value_mode": "auto",
  "limit": 500
}
```

Critical points:

- If `phase` defaults to `"all"` in MCP, it must also default to `"all"` before the authorization hash is created.
- If `value_mode` defaults to `"auto"` in MCP, it must also exist in the data-plan normalized arguments, or it must be omitted in both places.
- `bucket: "1d"` and `bucket: "day"` should not both exist as different normalized forms. Pick one canonical value.
- Metric aliases should normalize before authorization. For example, `kwh` and `energy` should map consistently.
- Start and end time should both be normalized to UTC ISO-8601 before hashing.

Recommended implementation rule:

The data-plan response is the source of truth. The AI Server should pass the returned arguments directly to MCP without changing them.

## Acceptance Tests

The developer should verify these before handing back:

1. `tools/list` returns only the intended EMS tools.
2. AI -> MCP with a wrong bearer token returns HTTP 401.
3. AI -> MCP with the correct bearer token succeeds.
4. MCP -> Django internal token hash matches between MCP and Django containers.
5. `site_metadata_summary` returns site id/name/counts.
6. `site_device_list` returns device IDs and status.
7. `device_metric_catalog` returns available metrics with unit, sample count, first timestamp, last timestamp, and coverage.
8. `device_telemetry_timeseries` for device ID 519 and metric `energy` returns numeric `value` rows.
9. Voltage/current/power queries return numeric values for a device that actually has those metrics.
10. Unsupported metric returns `UNSUPPORTED_METRIC`, not 401.
11. Missing rows return `NO_DATA`, not 401.
12. Reusing the same authorization returns `AUTHORIZATION_CONSUMED`.
13. Changing any authorized argument returns `AUTHORIZATION_DENIED`.
14. For telemetry authorization, the data-plan response arguments and MCP request arguments match exactly, excluding only `authorization_id`.
15. Top 5 energy devices can be answered using `device_energy_ranking` or by calculating from telemetry values.
16. Max demand can be calculated from `device_telemetry_timeseries` values without using `demand_peak_summary`.

## Message To Send Developer

Please rebuild the MCP tool surface using the original DaxView authorization protocol, but reduce the chatbot-facing tools to the EMS-focused OG 5:

- `site_metadata_summary`
- `site_device_list`
- `device_metric_catalog`
- `device_telemetry_timeseries`
- `device_energy_ranking`

Remove or disable forecast, anomaly, and standalone `demand_peak_summary` for now. The AI Server will calculate peak/max demand from device telemetry values.

The most important requirement is that the value tool returns actual numeric telemetry values for kWh, voltage, current, power, demand, power factor, frequency, and THD where available. The catalog tool must show which devices have which metrics so the chatbot does not guess.

Please keep the original authorization design:

1. AI Server requests data-plan authorization.
2. DaxView returns `authorization_id` and normalized arguments.
3. AI Server calls MCP using the exact normalized arguments returned by data-plan.
4. MCP/Django compares the same normalized argument hash.

Please ensure `phase`, `value_mode`, `bucket`, metric aliases, timezone, start/end time, and limit are normalized consistently in both the authorization path and the MCP execution path.

Also verify token separation:

- AI Server `DAXVIEW_MCP_AUTH_TOKEN` must match MCP `DAXVIEW_MCP_API_KEY`.
- MCP `DAXVIEW_AI_GATEWAY_TOKEN` must match Django `DAXVIEW_AI_GATEWAY_TOKEN`.
- AI Server must not store `DAXVIEW_AI_GATEWAY_TOKEN`.

The current failure pattern included `401 Unauthorized` and `AUTHORIZATION_DENIED`. If it fails again, please return safe debug information showing:

- received operation
- authorized operation
- received normalized argument hash
- authorized normalized argument hash
- mismatch field names
- HTTP status
- error code

Do not expose full tokens or authorization IDs in user-facing responses.
