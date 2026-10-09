# EMS MCP Developer Handoff: Device Data, Alarms, and Site Summary

## Purpose

Build a small, predictable MCP interface for the DaxView EMS chatbot. The chatbot should have three top-level choices:

1. `get_device_data` — device identity/configuration, supported metrics, and bounded historical telemetry.
2. `get_alarm_data` — current alarm state, historical alarm counts, and one alarm's stored details.
3. `get_site_summary` — site/building overview and compact energy summary.

The AI Server may rank returned devices and perform transparent calculations from returned numeric rows. DaxView remains responsible for identity/scope authorization, canonical metric mapping, units, cumulative-energy-to-consumption conversion, and demand semantics. Do not ask the LLM to calculate from prose or raw cumulative counters.

This handoff is based on the current V2 source tree. It proposes reducing the model-facing MCP tool names; each `operation` below must still map to a separately reviewed capability and authorization schema in V2. It does not authorize bypassing V2's data-plan flow or querying storage from MCP.

## Keep The V2 Authorization Protocol

1. AI Server selects a top-level MCP tool and a specific operation.
2. AI Server submits that operation and proposed arguments to V2's data-plan endpoint.
3. V2 validates the turn, user permission, site/device scope, operation, and arguments. It returns `authorization_id` and normalized arguments.
4. AI Server calls the corresponding MCP tool with the authorization ID and the exact normalized arguments.
5. MCP validates the capability and calls the fixed V2 historical execution endpoint.
6. Django atomically validates and consumes the authorization, then uses canonical V2 services to return bounded structured data.

The MCP call must not add, remove, default, rename, or remap fields after the data-plan response. Authorization is operation- and argument-bound and single-use. A follow-up or second data operation needs a new plan and authorization.

## Proposed MCP Tool 1: `get_device_data`

### Purpose

One discoverable tool for device questions. The required `operation` tells the gateway what kind of device data is requested. It is not an unrestricted SQL tool or a request to return every row for every device.

### Operations

| Operation | Use | Time range |
|---|---|---|
| `inventory` | List device details in a site/building, with freshness and configuration | None |
| `metric_catalog` | List configured metrics and observed availability for devices | Optional bounded historical window |
| `timeseries` | Return values for one device and one or more requested metrics | Required bounded historical window |
| `energy_ranking_data` | Return canonical per-device energy rows for the requested window; AI Server may sort/rank them | Required bounded historical window |

Do not include live telemetry, Redis snapshots, commands, or controls. A persisted “latest reading” operation should be added only if V2 confirms it reads the approved historical store and the capability is explicitly reviewed.

### Request schema

```json
{
  "authorization_id": "string",
  "operation": "timeseries",
  "site_id": 17,
  "building_id": null,
  "device_id": 519,
  "metrics": ["voltage_l1_n", "current_l1", "active_power_total"],
  "start_time": "2026-10-01T00:00:00+08:00",
  "end_time": "2026-10-02T00:00:00+08:00",
  "timezone": "Asia/Kuala_Lumpur",
  "bucket": "1h",
  "aggregation": "mean",
  "limit": 500
}
```

Rules:

- `operation` is required and must be one of the four listed operations.
- `site_id` is resolved from trusted turn context when allowed by the V2 contract; explicit IDs must still pass V2 scope checks.
- `device_id` is required for `timeseries`. A site-wide request must have an explicit bounded multi-device policy; do not silently turn one device query into all-device telemetry.
- `metrics` contains canonical/configured metric names. Reject unknown metrics; never silently substitute another metric.
- `start_time` and `end_time` are timezone-aware ISO-8601 values for historical operations. `end_time` must be after `start_time`, cannot be future/live, and the range cannot exceed the manifest's maximum (currently 366 days for the relevant V2 operations).
- `bucket` and `aggregation` use a reviewed enum. `raw` output is separately bounded. Use a coarser bucket when the requested interval would exceed the point limit.
- `limit` is capped server-side (the current telemetry capability is bounded at 2,000 points); never honor an unbounded client limit.
- The schema is operation-specific. Reject irrelevant fields rather than accepting a single loose object for every operation.

### Device inventory response

```json
{
  "success": true,
  "site": {"site_id": 17, "site_name": "Example Site"},
  "data": {
    "devices": [
      {
        "device_id": 519,
        "device_name": "Main Meter",
        "site_id": 17,
        "building_id": 4,
        "building_name": "Plant Room",
        "device_type": "Modbus",
        "manufacturer": "Example",
        "meter_model": "UMG",
        "status": "online",
        "data_status": "fresh",
        "last_seen": "2026-10-08T17:00:00+08:00",
        "age_seconds": 120,
        "expected_interval_seconds": 300,
        "supported_metrics": ["voltage_l1_n", "current_l1", "active_power_total"]
      }
    ],
    "count": 1,
    "truncated": false
  },
  "metadata": {"timezone": "Asia/Kuala_Lumpur", "generated_at": "2026-10-08T17:02:00+08:00"}
}
```

`manufacturer` and `meter_model` may be null if V2 has no configured value. Do not infer them from the device name.

### Metric catalog response

Return configured metric names, canonical names/units where mapping exists, and observed availability for the requested window:

```json
{
  "device_id": 519,
  "available_metrics": [
    {
      "metric": "voltage_l1_n",
      "canonical_metric": "voltage",
      "phase": "L1-N",
      "unit": "V",
      "configured": true,
      "available": true,
      "sample_count": 24,
      "first_timestamp": "2026-10-01T00:00:00+08:00",
      "last_timestamp": "2026-10-01T23:00:00+08:00",
      "coverage_percent": 100.0
    }
  ],
  "truncated": false
}
```

The current catalog implementation derives configured metric names from protocol-specific configuration tables. It must distinguish “configured” from “samples observed in the selected period.” If canonical unit/phase metadata is unavailable, return null/unknown rather than inventing it.

### Time-series response

```json
{
  "device_id": 519,
  "device_name": "Main Meter",
  "series": [
    {
      "metric": "voltage_l1_n",
      "canonical_metric": "voltage",
      "source_metric": "voltage_l1_n",
      "phase": "L1-N",
      "unit": "V",
      "value_mode": "measured",
      "aggregation": "mean",
      "points": [
        {"timestamp": "2026-10-01T00:00:00+08:00", "value": 240.8, "quality": "good"}
      ],
      "summary": {"count": 24, "min": 238.1, "max": 242.3, "avg": 240.5},
      "coverage_percent": 100.0,
      "truncated": false
    }
  ],
  "range": {"start": "2026-10-01T00:00:00+08:00", "end": "2026-10-02T00:00:00+08:00", "timezone": "Asia/Kuala_Lumpur"}
}
```

Every numeric point must carry timestamp, value, metric, and unit (at series level or point level with an unambiguous contract). Include source metric, value mode, aggregation, coverage/sample count, and truncation. Do not flatten phases into one series without identifying phase.

### Energy ranking data response

Return canonical consumption-delta rows, even if the AI Server performs sorting and rank assignment:

```json
{
  "value_mode": "consumption_delta",
  "unit": "kWh",
  "rows": [
    {"device_id": 519, "device_name": "Main Meter", "value": 884.8, "unit": "kWh", "sample_count": 2016, "coverage_percent": 98.5}
  ],
  "row_count": 1,
  "truncated": false,
  "range": {"start": "2026-10-01T00:00:00+08:00", "end": "2026-10-08T00:00:00+08:00", "timezone": "Asia/Kuala_Lumpur"}
}
```

V2's canonical consumption engine calculates these values. Do not return cumulative register values and expect the LLM to subtract them. The AI Server may deterministically sort the rows and assign ranks.

## Proposed MCP Tool 2: `get_alarm_data`

### Operations

| Operation | Use | Time range |
|---|---|---|
| `active_summary` | Currently open active/acknowledged alarms | Snapshot; no historical range |
| `frequency` | Historical alarm counts grouped by alarm/device/severity as supported | Required |
| `detail` | Stored lifecycle and trigger facts for a specific alarm/event | Alarm identifier required |

### Request schema

```json
{
  "authorization_id": "string",
  "operation": "active_summary",
  "site_id": 17,
  "building_id": null,
  "device_id": null,
  "alarm_id": null,
  "severity": null,
  "start_time": null,
  "end_time": null,
  "timezone": "Asia/Kuala_Lumpur",
  "limit": 50
}
```

Operation-specific rules:

- `active_summary`: return only active/acknowledged events that are not closed/resolved. No fake date range.
- `frequency`: require `start_time`, `end_time`, and timezone; cap range and rows; return count, first/last seen, severity, and stable alarm/device identifiers where available.
- `detail`: require one alarm/event reference and return only stored fields. Label whether the identifier is `alarm_id` or `alarm_event_id`; avoid ambiguous matching.
- Alarm names can come from parsed raw payload or `alarm_type`; if neither is populated, return a neutral fallback and preserve the missing-name signal.
- Never claim a root cause or recommended action unless V2 has stored evidence for it.

### Response shape

```json
{
  "active_count": 2,
  "critical_count": 1,
  "warning_count": 1,
  "alarms": [
    {
      "alarm_event_id": 9001,
      "alarm_id": 413,
      "alarm_name": "Overvoltage",
      "severity": "critical",
      "status": "active",
      "device_id": 519,
      "device_name": "Main Meter",
      "building_id": 4,
      "building_name": "Plant Room",
      "started_at": "2026-10-08T16:40:00+08:00"
    }
  ],
  "returned_count": 1,
  "truncated": false,
  "alarm_state": "open_active_or_acknowledged"
}
```

## Proposed MCP Tool 3: `get_site_summary`

### Operations

| Operation | Use |
|---|---|
| `overview` | Site identity, timezone, buildings, active device count, meter count when known |
| `energy_series` | Site canonical energy consumption grouped into bounded hour/day/week buckets |

### Request schema

```json
{
  "authorization_id": "string",
  "operation": "overview",
  "site_id": 17,
  "start_time": null,
  "end_time": null,
  "timezone": "Asia/Kuala_Lumpur",
  "bucket": "day",
  "limit": 100
}
```

For `overview`, dates are omitted. For `energy_series`, both dates are required, the window must be bounded, and the timezone bucket boundaries must be explicit. Return kWh, value mode `consumption_delta`, coverage, sample count, partial-bucket status when available, and truncation.

## Source Data In V2 (Confirmed In Repository)

MCP must not connect to these tables. They are listed for the V2 developer implementing or reviewing the Django operation, so they can trace the existing implementation and verify the live schema.

### Site and device metadata

| Data | V2 source tables / fields observed in code | Current usage |
|---|---|---|
| Site | `public.org_site`: `site_id`, `site_name`, `project_id`, `address`, `latitude`, `longitude`, `billing_timezone`, `country_code`, `market_code`, `currency_code` | `_single_site_row()` in `apps/backend/apps/core/ai_ems.py`; company name joins `public.org_project.project_id/project_name` |
| Building | `public.org_building`: `building_id`, `site_id`, `name`, `is_active`, `timezone` | `site_metadata_summary()` and scope checks |
| Device | `public.org_device`: `device_id`, `name`, `site_id`, `protocol_id`, `template_id`, `status`, `data_status`, `virtual_unit_id`, `expected_reporting_interval_seconds`, `decommissioned_at` | `site_device_list()` and `_device_in_site()` |
| Device protocol | `public.org_protocol`: `id`, `name` | Joined to `org_device.protocol_id` |
| Model/manufacturer config | `public.device_template`: `template_id`, `template_name`, `json_data` (`meter_model`/`model`, `manufacturer`/`brand`) | `site_device_list()`; fields may be absent/null |
| Device location | `public.org_device_location`: `device_id`, `building_id`, `floor_id`, `effective_to`, `is_primary`, `effective_from`; building via `public.org_floor` and `public.org_building` | Current effective location selected by V2 lateral query |
| Virtual device identity | `public.virtual_devices`: `virtual_id`, `virtual_name`, `site_id`, `is_active`; link table `public.org_device_virtual` | Used to map virtual alarms and telemetry identity |

### Configured metrics and telemetry history

| Protocol/source | Configuration source | Historical values |
|---|---|---|
| MQTT (`protocol_id=1`) | `public.config_mqtt_parameter`: `device_id`, `parameter`, `is_etl_enabled` (plus config-specific fields) | `public.etl_mqtt`: `timestamp`, `device_id`, `site_id`, metric columns such as voltage/current/power/energy |
| Modbus (`protocol_id=2`) | `public.config_modbus_parameter`: `device_id`, `parameter`, `is_etl_enabled` | `public.etl_modbus`: `timestamp`, `device_id`, `site_id`, metric columns such as `voltage_l1_n`, `current_l1`, `active_power_total`, energy fields |
| Virtual (`protocol_id=3`) | `public.config_virtual_parameter`: `virtual_id`, `parameter`, `is_etl_enabled`, `etl_interval_minutes` | `public.etl_virtual`: `timestamp`, `virtual_id`, metric/value columns |
| Manual imported device data (`protocol_id=4`) | `public.config_manual_parameter` | `public.manual_telemetry_point`: `device_id`, `parameter`, `timestamp`, `value`, `import_batch_id` |
| Backfill | Not a normal device source; selected where applicable by canonical readers | `public.etl_backfill`; V2 checks source/entity/metric and deduplicates against measured samples |

The exact metric column varies by protocol and configuration. V2 resolves it using `apps/enms/services/data_quality.py::resolve_series()` and queries the returned `SeriesDefinition` (`source_table`, entity/id column, parameter, unit/canonical metadata). Continue using this resolver. Do not build an LLM-provided SQL identifier or hard-code one column as if every protocol used it.

For consumption totals/rankings, use `apps/core/consumption_engine.py` (`get_site_consumption_sources`, `aggregate_device_consumption_totals`, `aggregate_site_consumption_series_with_display`). The engine handles effective source membership and canonical consumption delta. Do not reproduce its counter reset, rollover, or hierarchy logic in MCP or prompt text.

### Alarm lifecycle and detail

| Data | V2 source tables / fields observed |
|---|---|
| Alarm event | `public.alarm_events`: `event_id`, `alarm_id`, `site_id`, `device_id`, `virtual_id`, `alarm_type`, `severity`, `status`, `source`, `details`, `raw_payload`, `created_at` |
| Active lifecycle | `public.alarm_event_active`: `event_id` |
| Acknowledgement | `public.alarm_event_acknowlegde` (spelling is the existing table name): `event_id`, `read_by`, `read_at`, `ack_by`, `ack_at`, `resolution_note` |
| Resolved lifecycle | `public.alarm_event_resolved`: `event_id`, acknowledgement/read and resolved fields |
| Closed lifecycle | `public.alarm_event_closed`: `event_id`, acknowledgement/read and close fields |
| Alarm source names | `public.org_device`, `public.org_device_virtual`, `public.virtual_devices`; building through the effective `org_device_location`/floor/building joins |

V2's `active_alarm_summary()` currently filters lifecycle rows to active/acknowledged and excludes closed/resolved events. Historical frequency is implemented by `_alarm_frequency()` in `apps/core/ai_historical.py`. Keep lifecycle semantics in those V2 services.

### Existing implementation to inspect first

- MCP policy and tool definitions: `apps/mcp/server.py`
- Reviewed capability list and bounds: `apps/mcp/historical_capabilities.json`
- V2 schema normalization and authorization contract: `apps/backend/apps/core/ai_contract.py`
- Authorization issue/consume and endpoint boundary: `apps/backend/apps/core/ai_views.py`
- Canonical EMS reads: `apps/backend/apps/core/ai_ems.py`
- Legacy energy and alarm operations: `apps/backend/apps/core/ai_historical.py`
- Canonical consumption logic: `apps/backend/apps/core/consumption_engine.py`
- Metric resolution and coverage: `apps/backend/apps/enms/services/data_quality.py`
- Schema declarations: `init_schema.sql`, `cold_schema.sql`, and database patches under `scripts/db/patches/`

Use the deployed database schema as the final authority. SQL files and Django unmanaged models can be stale relative to a migrated environment; check the active migration/patch state before relying on a column name.

## Calculation Ownership

| Result | Owner |
|---|---|
| Device/site authorization, metric resolution, units and quality metadata | V2 canonical service |
| Cumulative register to consumption delta | V2 consumption engine |
| Fixed-interval maximum demand semantics and configured demand limits | V2 canonical demand service; do not substitute max instantaneous kW |
| Sort returned per-device energy rows and assign top-N rank | AI Server deterministic Python code is acceptable |
| Min/max/mean over a returned well-defined numeric series | AI Server deterministic Python code is acceptable; show metric/unit/phase/range and coverage |
| Explain results in natural language | LLM, grounded only in returned facts |

Every derived result should retain source operation, range, unit, value mode, coverage/sample count, and truncation metadata. If the returned data is incomplete or ambiguous, state that limitation or ask for another authorized query.

## Common Response And Error Rules

All success results are JSON objects with `success`, `data`, and `metadata`; include site/device identifiers and names where applicable. Use stable codes such as `INVALID_ARGUMENTS`, `SCOPE_DENIED`, `UNSUPPORTED_METRIC`, `NO_DATA`, `RANGE_TOO_LARGE`, `RESPONSE_TOO_LARGE`, and `SERVICE_UNAVAILABLE`. Never silently fall back to another source, metric, time range, or live endpoint.

Keep these cases distinct:

- `UNSUPPORTED_METRIC`: metric is not configured/supported for the selected device.
- `NO_DATA`: metric is supported, but no historical rows exist in the requested window.
- `SCOPE_DENIED`: selected site/building/device/alarm is outside authorized scope.
- `RANGE_TOO_LARGE`: range or expected output exceeds reviewed limits.
- `SERVICE_UNAVAILABLE`: source service failed; do not return invented values.

## Data And Query Safety Requirements

- MCP has no database, Redis, InfluxDB, MQTT, or storage credentials.
- Django execution remains read-only, scoped, parameterized, timeout-bounded, and protected by atomic authorization consumption.
- Never accept table names, column names, SQL, Django paths, HTTP methods, or URLs from the model/user.
- Validate operation-specific fields against the versioned capability manifest in MCP and V2.
- Bound rows, response bytes, time ranges, and runtime. Report `truncated` rather than implying completeness.
- Keep unit, timezone, value mode, metric mapping, phase, freshness, coverage, and provenance in the response.
- Do not expose secrets, authorization IDs, raw assertion values, or SQL errors in user-facing messages/logs.

## Developer Deliverables

1. Agree and version the three top-level MCP tool schemas and the operation enums in this document.
2. Map each operation to one existing V2 capability or propose a reviewed V2 capability change. Do not deploy an MCP-only operation.
3. Confirm the active DB schema for each table/column listed above and document differences from `init_schema.sql`/models.
4. Trace each result to the canonical service and define metric/unit/value-mode semantics, including phase mapping and energy/demand handling.
5. Implement exact data-plan-to-MCP argument pass-through and add a manifest/version/hash compatibility check.
6. Return stable, JSON-safe errors and common metadata (`range`, `timezone`, `unit`, `value_mode`, `coverage`, `sample_count`, `truncated`, provenance where relevant).
7. Provide request/response examples for inventory, metric discovery, timeseries, energy rows, active alarms, alarm frequency/detail, and site energy summary.
8. Update the AI Server planner so it chooses only these three top-level tools, then validates operation-specific arguments before requesting V2 authorization.
9. Provide a mapping from user-facing metric synonyms to canonical/configured metric names. Unknown mapping must result in catalog lookup or clarification, never a guessed column.

## Acceptance Criteria

- MCP tool discovery presents only the three agreed model-facing tools (or two if site summary is deliberately folded into device data).
- Each call resolves to an explicit reviewed V2 operation and exact authorized argument hash.
- No telemetry operation returns a metric that was not configured/resolved for that device.
- Data rows contain numeric values, timestamps, units, source/canonical metric names, and phase where relevant.
- Energy consumption is canonical `consumption_delta` in kWh; demand values retain fixed-interval demand semantics.
- Alarm active/frequency/detail outputs follow V2 lifecycle rules and include event/source identifiers.
- Access outside the approved site/device/building is denied even with a valid MCP service key.
- Oversized ranges/results are bounded and clearly marked; missing data and unsupported metrics are distinguishable.
- MCP cannot reach databases or live-value systems directly, and no write/control operation is exposed.
- The AI Server can rank or calculate only from returned numeric facts, with the range/coverage/unit context retained in the final answer.

## Scope Decision For First Delivery

Implement the two core tools first (`get_device_data`, `get_alarm_data`). Keep `get_site_summary` as the third tool if overview/energy-summary questions are a required use case. If the team chooses two tools, add `overview` and `energy_summary` as explicit `get_device_data` operations rather than returning them implicitly with every telemetry response.

Do not implement broad `get everything` behavior. The goal is clean, easy-to-calculate data with a small model-facing surface and explicit, bounded operations underneath.
