# Simplified EMS MCP Tool Specification

## Purpose

This document proposes a smaller MCP tool surface for the existing DaxView AI chatbot. It is a tool and data-detail proposal only. Keep the current AI Server, Chatbot UI, DaxView callback, authorization, and deployment architecture unchanged.

The goal is for the AI to receive clean, numeric, easy-to-use data and for each tool to read the correct configured device metric. The AI Server may perform deterministic ranking and calculations from returned rows. MCP must not accept SQL, table names, column names, arbitrary URLs, or arbitrary filters from the model.

## Proposed MCP Tools

Use these three model-facing MCP tools:

| Tool | Purpose |
|---|---|
| `device_data` | Return device details, available metrics, and historical device values. |
| `alarm_data` | Return alarm counts/details for a site, device, or time range. |
| `site_summary` | Return a site overview or site-level energy trend. |

If you prefer only two tools, merge `site_summary` operations into `device_data`. Keep alarm queries separate because alarms have a different record shape. These are MCP tool names; map them onto the existing MCP request/response and authorization flow without changing that flow.

## 1. `device_data`

### Purpose

One tool for device inventory/detail and historical telemetry. The `operation` field tells it which bounded result to return.

### Operations

| Operation | Returns | Required inputs |
|---|---|---|
| `list` | Device identity, location, model, protocol, status, last seen | Authorized site; optional building/filter and limit |
| `metrics` | Configured metric names and metric availability for a device | Authorized site; optional device and time range |
| `values` | Numeric historical values for one device and one or more configured metrics | Device, metric(s), start, end, timezone |
| `energy_rows` | Canonical per-device energy values for a site/building and period | Site, start, end, timezone |

### Example request: device values

```json
{
  "operation": "values",
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

### Example response: device values

```json
{
  "operation": "values",
  "device": {"device_id": 519, "device_name": "Main Meter", "site_id": 17},
  "range": {
    "start": "2026-10-01T00:00:00+08:00",
    "end": "2026-10-02T00:00:00+08:00",
    "timezone": "Asia/Kuala_Lumpur"
  },
  "series": [
    {
      "metric": "voltage",
      "source_metric": "voltage_l1_n",
      "source_column": "etl_modbus.voltage_l1_n",
      "phase": "L1-N",
      "unit": "V",
      "value_mode": "measured",
      "aggregation": "mean",
      "points": [
        {"timestamp": "2026-10-01T00:00:00+08:00", "value": 240.8}
      ],
      "sample_count": 24,
      "coverage_percent": 100.0,
      "truncated": false
    }
  ]
}
```

Return one series per source metric/phase. Values are JSON numbers, not formatted strings. Keep the source metric and source column in the result so developers can trace exactly what was read.

## 2. `alarm_data`

### Purpose

Return current or historical alarm facts. Suggested operations: `active`, `frequency`, and `detail`.

### Example request: active alarms

```json
{
  "operation": "active",
  "site_id": 17,
  "building_id": null,
  "device_id": null,
  "limit": 50
}
```

### Example response

```json
{
  "operation": "active",
  "active_count": 2,
  "alarms": [
    {
      "alarm_event_id": 9001,
      "alarm_id": 413,
      "alarm_name": "Overvoltage",
      "severity": "critical",
      "status": "active",
      "device_id": 519,
      "device_name": "Main Meter",
      "started_at": "2026-10-08T16:40:00+08:00"
    }
  ],
  "row_count": 1,
  "truncated": false
}
```

Historical `frequency` requires `start_time`, `end_time`, and timezone. `detail` requires an explicit `alarm_event_id` or `alarm_id`; do not treat the two identifiers as interchangeable. Active queries must exclude resolved and closed events. Do not invent alarm names or root causes if the stored fields are empty.

## 3. `site_summary`

### Purpose

Return a small site/building overview or site-level energy time series.

### Operations

- `overview`: site name, timezone, buildings, device counts and status counts.
- `energy`: bounded site energy buckets for a requested historical period.

Energy must be returned in kWh as canonical consumption deltas, not a sum of cumulative meter-register values.

## V2 Database Table And Column Guide

The table/column names below are present in V2's checked-in SQL/code. Have the developer verify them against the actual database before release.

### Device detail

| Data | Table / column |
|---|---|
| Device ID/name/site/protocol/template/status | `public.org_device.device_id`, `name`, `site_id`, `protocol_id`, `template_id`, `status`, `data_status`, `virtual_unit_id`, `expected_reporting_interval_seconds`, `decommissioned_at` |
| Protocol name | `public.org_protocol.name`, join `org_device.protocol_id = org_protocol.id` |
| Model/manufacturer | `public.device_template.template_name`; `json_data ->> 'meter_model'/'model'` and `json_data ->> 'manufacturer'/'brand'` |
| Building/floor | Current row in `public.org_device_location`; join `org_floor` by `floor_id`, then `org_building` by `building_id`. Prefer `effective_to IS NULL`, primary row, newest `effective_from`. |
| Last seen | Maximum `timestamp` from the correct protocol's ETL table. For virtual devices, match `org_device.virtual_unit_id` to `etl_virtual.virtual_id`. |

### Configured metric → actual value column

First determine the device protocol. Then look up enabled parameter configuration for that device. The configured `parameter` is the key that identifies which value column to read.

| Protocol | Config table / key | Historical data table / key |
|---|---|---|
| MQTT (`protocol_id=1`) | `public.config_mqtt_parameter`, keyed by `device_id`; fields include `parameter`, `is_etl_enabled` | `public.etl_mqtt`, keyed by `device_id` and `timestamp` |
| Modbus (`protocol_id=2`) | `public.config_modbus_parameter`, keyed by `device_id`; fields include `parameter`, `is_etl_enabled` | `public.etl_modbus`, keyed by `device_id` and `timestamp` |
| Virtual (`protocol_id=3`) | `public.config_virtual_parameter`, keyed by `virtual_id`; includes `parameter`, `is_etl_enabled`, `etl_interval_minutes` | `public.etl_virtual`, keyed by `virtual_id` and `timestamp` |
| Manual (`protocol_id=4`) | `public.config_manual_parameter`, keyed by `device_id` | `public.manual_telemetry_point`, keyed by `device_id`, `parameter`, `timestamp`; numeric reading is `value` |

Common wide columns present in the checked-in MQTT, Modbus, and virtual ETL schemas:

| User asks for | Common source column(s) | Typical unit (verify configuration) |
|---|---|---|
| Phase-neutral voltage | `voltage_l1_n`, `voltage_l2_n`, `voltage_l3_n` | V |
| Phase-phase voltage | `voltage_l1_l2`, `voltage_l2_l3`, `voltage_l3_l1` | V |
| Phase current | `current_l1`, `current_l2`, `current_l3`; also `neutral_current` | A |
| Active power | `active_power_total`, `active_power_l1`, `active_power_l2`, `active_power_l3` | kW (verify scale) |
| Reactive power | `reactive_power_total`, `reactive_power_l1/l2/l3` | kvar (verify scale) |
| Apparent power | `apparent_power_total`, `apparent_power_l1/l2/l3` | kVA (verify scale) |
| Power factor | `power_factor_total`, `power_factor_l1/l2/l3` | dimensionless |
| Frequency | `frequency` | Hz |
| Voltage THD | `thd_voltage_l1/l2/l3`; aliases `thd_u_l1/l2/l3` | Verify whether ratio or percent |
| Current THD | `thd_current_l1/l2/l3`; aliases `thd_i_l1/l2/l3` | Verify whether ratio or percent |
| Energy register | `active_energy_consumed_total`, `active_energy_consume` | Often kWh, but may be cumulative |
| Virtual generic value | `etl_virtual.value` | Determined by configured parameter |

The exact available columns can differ by protocol and deployed schema. Do not assume a metric exists because its column exists: only return metrics configured for the selected device and present in the correct source table. A generic request for “voltage” may map to multiple phase columns. Return phases separately or clarify which phase is wanted.

### Precise mapping requirement

For each requested metric, implement and document this chain:

`user metric phrase → configured parameter → canonical metric/phase → source table → source column → unit/value mode`

V2's existing resolver is `apps/enms/services/data_quality.py::resolve_series()`. It resolves the actual `source_table`, `id_column`, `entity_id`, `resolved_value_column`, canonical parameter, unit, calibration, interval, and value mode. Use this behavior or the same trusted configuration mapping. Never put an LLM-provided string directly into a SQL identifier.

## Energy, Ranking, And Calculation

- Raw energy register columns can be cumulative. Do not sum the register readings and label that energy consumption.
- For energy totals and site/device energy rows, use the existing canonical DaxView consumption calculation in `apps/backend/apps/core/consumption_engine.py`.
- Return canonical energy as `value_mode: "consumption_delta"`, `unit: "kWh"`, and include range and coverage.
- The AI Server can sort those numeric device rows to answer “top devices.”
- Voltage/current min/max/average and peak timestamps can be calculated deterministically by the AI Server when the returned metric, phase, unit, and sample coverage are clear.
- Do not label maximum instantaneous active power as fixed-interval maximum demand unless that is the configured demand definition.

## MCP Request And Safety Requirements

- Preserve the existing MCP transport and AI Server ↔ DaxView behavior. This document does not request new services, callbacks, credentials, or frontend changes.
- Each tool has a small operation enum and strict operation-specific arguments.
- Use the existing authorization and scope rules. Do not allow a valid MCP service key alone to grant access to another site/device.
- Use timezone-aware timestamps; reject invalid or oversized ranges; cap result rows/points.
- Return `UNSUPPORTED_METRIC` if a metric is not configured, and `NO_DATA` if it is configured but has no samples in the range.
- Include `truncated`, timestamps, units, source metric/column, phase, aggregation, and range where applicable.
- MCP must not accept arbitrary SQL, table/column names, paths, or URLs.
- Do not return live Redis/MQTT data, commands, writes, or controls through these read tools.

## Developer Deliverables

1. Implement the three MCP tools and operations in this spec, or fold `site_summary` into `device_data` if selecting the two-tool option.
2. Provide a metric mapping table using the chain: user phrase → configured parameter → source table.column → unit/phase/value mode.
3. Verify table columns against the deployed database using `information_schema`; record any differences from V2's checked-in SQL.
4. Provide example responses for device list, metric discovery, values, energy rows, active alarms, alarm frequency, alarm detail, and site overview.
5. Show distinct responses for unsupported metric, no data, stale device, and truncated data.
6. Confirm the current integration contract still works without changes to AI Server, Chatbot UI, or DaxView authorization/callback architecture.

## Acceptance Criteria

- The LLM sees only two or three clear MCP tools rather than a long list of similar choices.
- Voltage/current/power requests read the configured source column for that device's protocol and report phase/unit correctly.
- Device and site scope are applied to every query.
- Energy is canonical consumption-delta kWh; AI ranking is performed only on returned numeric rows.
- Alarm lifecycle statuses are clear and stable.
- Missing, unsupported, partial, and truncated data are not presented as complete values.
- Existing chatbot and AI Server integration behavior is unchanged.
