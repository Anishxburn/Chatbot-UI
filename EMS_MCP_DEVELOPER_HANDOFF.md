# EMS MCP Database Mapping and Tool Specification

## Purpose

Build a simple MCP interface for the EMS chatbot that returns clean, numeric, correctly sourced data. This document is a database and implementation handoff for the developer.

The chatbot should expose these three model-facing tools:

1. `get_device_data` — device detail, available metrics, and requested historical values.
2. `get_alarm_data` — active alarms, historical alarm counts, and alarm details.
3. `get_site_summary` — site/building overview and site energy series.

The AI Server can rank and calculate from the returned numeric rows. It must not guess table names, metric columns, units, or whether an energy value is a cumulative counter. Return source data in a structured format with enough metadata for deterministic code to calculate correctly.

## Scope Of This Request

This request is to simplify and make precise the MCP tool surface and its database mappings. The current AI Server, Chatbot UI, and DaxView integration are already working and should remain unchanged unless a separate change is explicitly agreed.

This is a specification for the MCP developer. It does not request redesign of the AI Server ↔ DaxView authorization/callback protocol. The developer must preserve the current working integration contract and confirm the exact deployed MCP request path before implementation.

MCP must remain a narrow read-only interface. Never accept SQL, table names, column names, HTTP paths, or arbitrary filters from the LLM. The user/model chooses a named operation and approved metric; server code resolves that to trusted mappings.

## Tool Count Recommendation

Three top-level tools are recommended:

| Tool | Reason to keep separate |
|---|---|
| `get_device_data` | Device telemetry is high-volume, metric- and time-range-specific data. |
| `get_alarm_data` | Alarm records have a different event lifecycle and query shape. |
| `get_site_summary` | Site overview and energy buckets are small, common summary requests. |

If the team wants exactly two tools, fold the `overview` and `energy_series` operations into `get_device_data`. Do not merge alarm events into device telemetry responses. The operation must remain explicit either way.

The names above are the MCP-facing tools. Each tool can have a small, explicit `operation` enum. This reduces tool-selection noise without creating an unrestricted “fetch everything” endpoint.

## Database Source Map: Device And Telemetry Data

### Device identity and details

| Returned field | V2 table.column | Notes |
|---|---|---|
| `device_id` | `public.org_device.device_id` | Stable device identifier. |
| `device_name` | `public.org_device.name` | Human-readable device name. |
| `site_id` | `public.org_device.site_id` | Scope device to site. |
| `protocol_id` | `public.org_device.protocol_id` | Protocol selects the telemetry source/config table. |
| `device_type` | `public.org_protocol.name`, joined by `org_device.protocol_id = org_protocol.id` | Examples include MQTT, Modbus, Virtual, Manual; use actual configured values. |
| `template_id` | `public.org_device.template_id` | Joins device metadata to template. |
| `manufacturer` | `public.device_template.json_data ->> 'manufacturer'` or `->> 'brand'` | Nullable JSON configuration; don't infer from name. |
| `meter_model` | `public.device_template.json_data ->> 'meter_model'` or `->> 'model'`; fallback `device_template.template_name` | Nullable. |
| `configured_status` | `public.org_device.status` | Configuration/status label only; not sufficient to determine data freshness. |
| `data_status` | `public.org_device.data_status` | Useful context; derive online/stale/offline from last seen as well. |
| `expected_reporting_interval_seconds` | `public.org_device.expected_reporting_interval_seconds` | MQTT/default may use 60s, others 300s; virtual may use config interval. |
| `virtual_unit_id` | `public.org_device.virtual_unit_id` | For virtual source mapping. |
| `decommissioned_at` | `public.org_device.decommissioned_at` | Exclude decommissioned devices from active inventory by default. |
| `building_id` | `public.org_device_location.building_id`, or `org_floor.building_id` via `floor_id` | Use current effective location (`effective_to IS NULL`), prefer `is_primary`, latest `effective_from`. |
| `building_name` | `public.org_building.name` | Join using resolved building ID. |
| `floor_id` / `floor_name` | `public.org_device_location.floor_id` → `public.org_floor.floor_id/name` | Only include if requested; floor assignment may be null. |
| `last_seen` | `MAX(timestamp)` from protocol's ETL source table | Query correct source by protocol and identifier; do not rely only on static status. |

For device location, use the same effective-location selection pattern as V2 code. A device may have historical location rows; joining every row can duplicate inventory or energy results.

### Protocol configuration: which metric columns are configured

Do not assume every device supports every metric. The configuration tables determine which parameter names are enabled for ETL.

| Device protocol | Config table | Identifying key | Metric/config fields |
|---|---|---|---|
| MQTT (`protocol_id=1`) | `public.config_mqtt_parameter` | `device_id` | `parameter`, `is_etl_enabled`; check the deployed schema for effective dates/unit fields. |
| Modbus (`protocol_id=2`) | `public.config_modbus_parameter` | `device_id` | `parameter`, `is_etl_enabled`; check the deployed schema for effective dates/unit fields. |
| Virtual (`protocol_id=3`) | `public.config_virtual_parameter` | `virtual_id` matched to `org_device.virtual_unit_id` | `parameter`, `is_etl_enabled`, `etl_interval_minutes`. |
| Manual (`protocol_id=4`) | `public.config_manual_parameter` | `device_id` | `parameter`; imported values are in `manual_telemetry_point`. Verify active/configuration fields in deployed schema. |

### Telemetry value tables and exact common columns

For MQTT and Modbus devices, commonly used metrics are wide numeric columns in their respective ETL tables. The checked-in V2 schema contains these columns:

| Meaning / returned metric | MQTT table.column | Modbus table.column | Virtual table.column | Unit guidance |
|---|---|---|---|---|
| Sample time | `etl_mqtt.timestamp` | `etl_modbus.timestamp` | `etl_virtual.timestamp` | Timestamp with timezone. |
| Device key | `etl_mqtt.device_id` | `etl_modbus.device_id` | `etl_virtual.virtual_id` | Virtual uses `org_device.virtual_unit_id`, not device ID, to query samples. |
| Site key | `etl_mqtt.site_id` | `etl_modbus.site_id` | Verify deployed schema | Still apply authorized `org_device.site_id` scope. |
| Voltage phase L1-N | `voltage_l1_n` | `voltage_l1_n` | `voltage_l1_n` | Commonly V; use configured/unit metadata where available. |
| Voltage phase L2-N | `voltage_l2_n` | `voltage_l2_n` | `voltage_l2_n` | Commonly V. |
| Voltage phase L3-N | `voltage_l3_n` | `voltage_l3_n` | `voltage_l3_n` | Commonly V. |
| Voltage L1-L2 | `voltage_l1_l2` | `voltage_l1_l2` | `voltage_l1_l2` | Commonly V. |
| Voltage L2-L3 | `voltage_l2_l3` | `voltage_l2_l3` | `voltage_l2_l3` | Commonly V. |
| Voltage L3-L1 | `voltage_l3_l1` | `voltage_l3_l1` | `voltage_l3_l1` | Commonly V. |
| Current phase L1 | `current_l1` | `current_l1` | `current_l1` | Commonly A. |
| Current phase L2 | `current_l2` | `current_l2` | `current_l2` | Commonly A. |
| Current phase L3 | `current_l3` | `current_l3` | `current_l3` | Commonly A. |
| Neutral current | `neutral_current` | `neutral_current` | `neutral_current` | Commonly A. |
| Active power total | `active_power_total` | `active_power_total` | `active_power_total` | Commonly kW; confirm scaling/unit configuration. |
| Active power phases | `active_power_l1/l2/l3` | `active_power_l1/l2/l3` | `active_power_l1/l2/l3` | Commonly kW; keep phase separate. |
| Reactive power total/phases | `reactive_power_total`, `_l1`, `_l2`, `_l3` | Same named columns | Same named columns | Usually kvar; confirm metadata. |
| Apparent power total/phases | `apparent_power_total`, `_l1`, `_l2`, `_l3` | Same named columns | Same named columns | Usually kVA; confirm metadata. |
| Power factor total/phases | `power_factor_total`, `_l1`, `_l2`, `_l3` | Same named columns | Same named columns | Dimensionless. |
| Frequency | `frequency` | `frequency` | `frequency` | Usually Hz. |
| THD voltage phase values | `thd_voltage_l1/l2/l3`; aliases `thd_u_l1/l2/l3` exist | Same named columns | Same named columns | Percentage or ratio depends on meter/config. Do not assume scaling. |
| THD current phase values | `thd_current_l1/l2/l3`; aliases `thd_i_l1/l2/l3` exist | Same named columns | Same named columns | Percentage or ratio depends on meter/config. |
| Active energy register | `active_energy_consumed_total`, `active_energy_consume` | `active_energy_consumed_total`, `active_energy_consume` | Same named columns | These may be cumulative counters. Do not sum as consumption. |
| Generic virtual/manual value | Not applicable | Not applicable | `etl_virtual.value`; manual uses `manual_telemetry_point.value` keyed by parameter | Meaning/unit comes from configured parameter metadata. |
| Estimated marker | `etl_mqtt.is_estimated` | `etl_modbus.is_estimated` | `etl_virtual.is_estimated` | Preserve if present; do not present estimated data as measured. |

The `etl_virtual` table in `cold_schema.sql` includes the listed metric columns, but verify the exact deployed version. Manual point tables are long-form: one row per `device_id`, `parameter`, and `timestamp`, with numeric `value`.

The source parameter is not necessarily the output column name users say. Example: “voltage” may map to several configured phase columns (`voltage_l1_n`, `voltage_l2_n`, `voltage_l3_n`); return each phase as a separate series, or ask which phase if the user expects a single value.

### Metric resolution rule

Resolve a requested metric against the device's configured `parameter` in the protocol-specific configuration table. Use the registered parameter-to-column mapping. Then query the protocol's ETL table using that resolved, trusted column identifier.

V2 already implements this logic in `apps/enms/services/data_quality.py::resolve_series()`. It returns `SeriesDefinition` fields including:

- `source_table` — `etl_mqtt`, `etl_modbus`, `etl_virtual`, or supported source;
- `id_column` — usually `device_id` or `virtual_id`;
- `entity_id` — device or virtual entity key;
- `requested_parameter` and `resolved_value_column`;
- `canonical_parameter`;
- `base_unit`, `effective_unit`, configured prefix, and calibration formula;
- `value_mode`, interval, effective dates, and semantic revision.

This is the most precise source-of-truth mapping in the repository. The MCP developer should reproduce its *behavior* through an approved server-side resolver or use the corresponding DaxView data service. Do not copy a small hard-coded metric list and assume it covers every installed meter. Do not interpolate an unvalidated model-provided string into SQL.

### Table/column discovery queries for developer verification

Run these against the actual V2 database before finalizing the mapping. These are developer inspection queries only; do not expose arbitrary SQL through MCP.

```sql
-- Confirm actual columns for source tables in the deployed database.
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'org_device', 'org_protocol', 'device_template', 'org_device_location',
    'org_building', 'org_floor', 'config_mqtt_parameter',
    'config_modbus_parameter', 'config_virtual_parameter',
    'config_manual_parameter', 'etl_mqtt', 'etl_modbus', 'etl_virtual',
    'manual_telemetry_point', 'alarm_events', 'alarm_event_active',
    'alarm_event_acknowlegde', 'alarm_event_resolved', 'alarm_event_closed'
  )
ORDER BY table_name, ordinal_position;

-- Inspect enabled configured parameter names (scope by a specific device).
SELECT parameter, is_etl_enabled
FROM public.config_modbus_parameter
WHERE device_id = :device_id
ORDER BY parameter;

-- Inspect actual populated ETL columns for a specific Modbus device.
SELECT timestamp, voltage_l1_n, current_l1, active_power_total,
       active_energy_consumed_total, frequency
FROM public.etl_modbus
WHERE device_id = :device_id
  AND timestamp >= :start_time AND timestamp < :end_time
ORDER BY timestamp
LIMIT 100;
```

Repeat parameter inspection against the correct protocol config table and source table. Never use the example SQL without confirming the device's protocol and metric configuration first.

## Database Source Map: Alarms

| Returned field | V2 table.column / join | Notes |
|---|---|---|
| Event ID | `public.alarm_events.event_id` | Unique lifecycle event identifier. |
| Alarm ID | `public.alarm_events.alarm_id` | Definition/business alarm identifier; do not confuse with event ID. |
| Site | `public.alarm_events.site_id` | Apply authorized site scope. |
| Device | `public.alarm_events.device_id` | May be null for virtual alarm. |
| Virtual source | `public.alarm_events.virtual_id` → `public.virtual_devices.virtual_id/virtual_name` | `org_device_virtual` can associate virtual IDs with physical devices. |
| Alarm name/type | `alarm_events.raw_payload -> 'parsed' ->> 'alarm_name'`, fallback `alarm_events.alarm_type` | If absent, return `null` or “Alarm”; do not invent. |
| Severity/state/source | `alarm_events.severity`, `.status`, `.source` | Preserve source values; normalize severity only under documented mapping. |
| Details | `alarm_events.details`, `.raw_payload` | Return only safe, bounded, user-facing fields; don't dump arbitrary payloads wholesale. |
| Started/created time | `alarm_events.created_at` | Return ISO-8601 with timezone. |
| Active state | `public.alarm_event_active.event_id` | Join to identify active lifecycle. |
| Acknowledged state/time | `public.alarm_event_acknowlegde.event_id`, `ack_at`, `ack_by`, `resolution_note` | Table spelling is as currently defined in V2. |
| Resolved state/time | `public.alarm_event_resolved.event_id`, `resolved_at`, `resolved_by`, `resolution_note` | Lifecycle table. |
| Closed state/time | `public.alarm_event_closed.event_id`, `close_at`, `close_by`, `resolution_note` | Lifecycle table. |

For active alarms include active/acknowledged and exclude resolved/closed events. For historical frequency count event rows in the requested interval and group by a stable, non-null alarm type/name; include first and last seen. For detail, make the requested identifier explicit as `alarm_event_id` or `alarm_id`.

## Database Source Map: Site Summary

| Returned field | V2 table.column / service |
|---|---|
| Site ID/name | `public.org_site.site_id`, `.site_name` |
| Company/project | `public.org_site.project_id` → `public.org_project.project_id/project_name` |
| Site location | `org_site.address`, `.latitude`, `.longitude` |
| Country/currency/timezone | `org_site.country_code`, `.currency_code`, `.billing_timezone` |
| Buildings | `public.org_building.building_id`, `.site_id`, `.name`, `.is_active`, `.timezone` |
| Active device count | `public.org_device` filtered by `site_id`, `decommissioned_at IS NULL`, and active lifecycle statuses |
| Online/stale/offline count | Latest source timestamp by protocol plus expected report interval; do not rely on `org_device.status` alone |
| Site energy buckets | Do not sum arbitrary raw ETL counters. Use the DaxView consumption source membership and canonical energy aggregation service described below. |

## Canonical Energy And Demand Rules

### Energy

Raw ETL columns such as `active_energy_consumed_total` are likely counters/registers. Summing those readings gives the wrong consumption. For an energy-consumption query, use configured site source membership and DaxView's canonical consumption calculation. In V2 that logic is in `apps/core/consumption_engine.py` (`get_site_consumption_sources`, `aggregate_device_consumption_totals`, `aggregate_site_consumption_series_with_display`).

Return:

- `metric: "energy"`, `unit: "kWh"`, `value_mode: "consumption_delta"`;
- requested range and timezone;
- points or device rows with numeric values;
- coverage/sample counts and whether data is partial/truncated;
- source device IDs and names.

The AI Server can sort these numeric rows to calculate top consumers. It must not calculate register deltas itself.

### Demand

Do not call `MAX(active_power_total)` “maximum demand” unless the device/business definition explicitly says that instantaneous active power is demand. Fixed-interval maximum demand is a separate semantic. Use the configured demand source/resolver and return its interval, unit (`kW`), timestamp, limit if available, and calculation basis. The LLM can explain or compare the returned values but must not reinterpret them.

## Tool Contracts

### 1. `get_device_data`

Operations: `inventory`, `metric_catalog`, `timeseries`, `energy_rows`.

Example telemetry request:

```json
{
  "operation": "timeseries",
  "site_id": 17,
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

Return each requested metric as a distinct series with `device_id`, `device_name`, `metric`, `source_metric`, `canonical_metric`, `phase`, `unit`, `value_mode`, `aggregation`, numeric points, sample count, coverage, and truncation. `inventory` returns device metadata; `metric_catalog` separates configured from observed metrics; `energy_rows` returns canonical consumption-delta rows without requiring MCP to rank them.

### 2. `get_alarm_data`

Operations: `active_summary`, `frequency`, `detail`.

Example active request:

```json
{
  "operation": "active_summary",
  "site_id": 17,
  "building_id": null,
  "device_id": null,
  "severity": null,
  "limit": 50
}
```

Historical `frequency` requires `start_time`, `end_time`, and timezone. `detail` requires either `alarm_event_id` or `alarm_id`, never an ambiguous generic `alarm_id` slot. Return stable identifiers, names, severity, state, timestamps, device/building context, row count, and truncation.

### 3. `get_site_summary`

Operations: `overview`, `energy_series`.

`overview` returns site identity, timezone, building list, device counts, and online/stale/offline counts when derivable. `energy_series` requires a bounded time range and bucket (`hour`, `day`, or `week`) and returns canonical kWh consumption deltas with range, timezone, coverage, and partial/truncated metadata.

## General Request/Response Rules

- Use explicit operation-specific input schemas. Reject unknown fields.
- Use timezone-aware ISO-8601 timestamps; reject invalid, future/live, or oversized historical ranges.
- Keep row/point limits bounded and return `truncated: true` when applicable.
- Return numeric values as numbers, not formatted strings.
- Include unit, metric/source column, device ID/name, phase, timestamp, aggregation, and value mode.
- Keep errors distinct: `UNSUPPORTED_METRIC`, `NO_DATA`, `DEVICE_NOT_FOUND`, `SCOPE_DENIED`, `INVALID_ARGUMENTS`, `RANGE_TOO_LARGE`, and `BACKEND_UNAVAILABLE`.
- Never silently swap a metric, phase, source table, or time range.
- MCP must not have direct database credentials if the current deployment architecture forbids them. If the MCP developer is implementing a DB-backed adapter, it must run inside the approved V2 backend trust boundary using a read-only DB role and existing authorization/scope checks; do not expose DB connectivity from the external AI Server.

## Developer Deliverables

1. Implement the agreed two- or three-tool surface with the exact operation enums above.
2. For each metric, provide a checked mapping: user phrase → canonical metric → configured parameter → resolved ETL table.column → unit/phase/value mode.
3. Confirm each table and column against the deployed database using `information_schema`; record any difference from `cold_schema.sql`, `init_schema.sql`, and Django models.
4. Document device protocol routing and virtual/manual identifier joins.
5. Provide sample JSON for every operation and for `UNSUPPORTED_METRIC`, `NO_DATA`, stale device, and truncated response.
6. Demonstrate that energy uses canonical consumption deltas and that demand uses the correct demand semantics.
7. Keep the existing AI Server, Chatbot UI, and DaxView integration request/response behavior unchanged unless separately approved.

## Acceptance Criteria

- The LLM sees only two or three concise MCP tools, each with clear purpose and operation enum.
- A request for voltage/current returns the correctly configured voltage/current column(s) for that device's protocol; unsupported phases/metrics are reported explicitly.
- One device's data does not leak into another site's result; all IDs are scope-checked.
- Returned values are numeric and include timestamps, units, metric/column names, phase, value mode, coverage/sample count, and range.
- Energy totals/rankings use `consumption_delta` kWh rather than a sum of cumulative register values.
- Alarm state distinguishes active, acknowledged, resolved, and closed lifecycle records.
- No LLM-supplied table name, column name, SQL, or URL reaches a query executor.
- Large responses are bounded, marked as truncated, and never presented as complete.
- Existing chatbot/AI-server integration contracts remain compatible.
