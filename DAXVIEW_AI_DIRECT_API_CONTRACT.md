# DaxView AI Direct API Contract

## Purpose

This is the proposed replacement path while MCP is halted. The chatbot calls a small read-only DaxView API surface instead of MCP tools or data-plan authorization.

Base URL:

```text
https://event.daxview.com/api
```

Recommended auth:

```http
Authorization: Bearer <read-only AI direct API token>
```

The token should be scoped to read-only EMS data only. It should not be the Django secret key. It can be a new token or a DaxView-validated service token equivalent to the existing AI gateway trust model.

## Endpoints

### `GET /api/ai/direct/devices/`

Query:

```text
site_id=17
building_id=<optional>
limit=500
```

Response:

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
      "manufacturer": null,
      "meter_model": null
    }
  ],
  "device_count": 1,
  "truncated": false
}
```

### `GET /api/ai/direct/energy-ranking/`

Query:

```text
site_id=17
building_id=<optional>
from=2026-10-01T00:00:00+00:00
to=2026-10-08T00:00:00+00:00
timezone=Asia/Kuala_Lumpur
limit=5
```

Response:

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

### `GET /api/ai/direct/telemetry/`

Query:

```text
site_id=17
device_id=519
metric=energy
phase=all
from=2026-10-01T00:00:00+00:00
to=2026-10-08T00:00:00+00:00
timezone=Asia/Kuala_Lumpur
bucket=1d
aggregation=auto
value_mode=auto
limit=500
```

Response:

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

## Error Shape

```json
{
  "status": "error",
  "error_code": "NO_DATA",
  "message": "No telemetry rows exist for the requested range.",
  "metadata": {
    "site_id": 17,
    "device_id": 519
  }
}
```

Stable error codes:

- `UNAUTHORIZED`
- `FORBIDDEN`
- `VALIDATION_ERROR`
- `NO_DATA`
- `UNSUPPORTED_METRIC`
- `LIMIT_EXCEEDED`
- `BACKEND_UNAVAILABLE`

