# DaxView MCP Improvement Specification

Audience: DaxView backend/MCP developers, AI Server developers, QA.

Purpose: define what the MCP tools must expose so the chatbot can answer EMS questions reliably, identify current weak/broken tool behavior from testing, and specify which database data should be pulled for each tool.

Reference test artifact: `DaxView_MCP_Tool_Tests Result.xlsx`.

## 1. Current Finding

The AI Server can connect to MCP. The issue is not basic connectivity. Several MCP tools return data correctly, while others return unavailable, 404, 400, incomplete fields, or vague output that the chatbot cannot safely use.

Working or mostly working tools:

- `site_metadata_summary`
- `site_device_list`
- `meter_status_summary` partially
- `active_alarm_summary`
- `site_energy_summary`

Weak, incomplete, or failing tools:

- `telemetry_top_consumers`
- `device_energy_breakdown`
- `telemetry_timeseries`
- `data_availability_summary`
- `demand_peak_summary`
- `power_quality_summary`
- `tariff_cost_summary`
- `report_summary`
- `alarm_frequency_summary`
- `alarm_detail_lookup`
- `energy_comparison_summary`

Main improvement needed:

The MCP should expose stable structured EMS data, not only short summaries. Each tool must return predictable JSON fields, clear error codes, source scope, time window, row count, and data coverage.

## 2. Required Standard Response Contract

Every successful MCP tool response should use this structure:

```json
{
  "status": "ok",
  "operation_id": "tool_name",
  "read_only": true,
  "historical_only": true,
  "data": {},
  "metadata": {
    "site_id": 17,
    "building_id": null,
    "device_id": null,
    "timezone": "Asia/Kuala_Lumpur",
    "start_time": "2026-10-01T00:00:00+08:00",
    "end_time": "2026-10-07T00:00:00+08:00",
    "generated_at": "2026-10-07T10:00:00+08:00",
    "source": "daxview_backend",
    "row_count": 0,
    "coverage_percent": null
  }
}
```

Every failed MCP response should use this structure:

```json
{
  "status": "error",
  "operation_id": "tool_name",
  "error_code": "NO_DATA",
  "message": "No readings found for this site/device/time window.",
  "metadata": {
    "site_id": 17,
    "device_id": 519,
    "timezone": "Asia/Kuala_Lumpur",
    "start_time": "2026-10-01T00:00:00+08:00",
    "end_time": "2026-10-07T00:00:00+08:00"
  }
}
```

Use specific error codes:

- `NO_DATA`: tool ran, but no rows matched.
- `UNSUPPORTED_METRIC`: metric is not collected or not exposed.
- `INVALID_SITE`: site does not exist or is not authorized.
- `INVALID_BUILDING`: building does not exist or is not authorized.
- `INVALID_DEVICE`: device does not exist or is not authorized.
- `INVALID_TIME_RANGE`: range is invalid or too large.
- `TOOL_NOT_IMPLEMENTED`: MCP tool exists in contract but backend has not implemented it.
- `BACKEND_UNAVAILABLE`: backend service/database temporarily unavailable.
- `AUTHORIZATION_DENIED`: authorization_id is invalid, expired, mismatched, or consumed.

Avoid vague `DAXVIEW_UNAVAILABLE` unless the whole backend is truly unavailable.

## 3. Database Data Required By Tool

The table names below are logical source categories. Developers should map them to actual DaxView tables/models.

### 3.1 `site_metadata_summary`

Purpose: provide site context.

Pull from DB:

- Site/company table.
- Building table.
- Device/meter table.
- Site timezone/location/settings table.

Required fields:

- `site_id`
- `site_name`
- `company_id`
- `company_name`
- `timezone`
- `location`
- `building_count`
- `device_count`
- `meter_count`
- `buildings[]`

Recommended fields:

- `country`
- `currency`
- `tariff_profile_id`
- `site_type`
- `available_tools[]`

Acceptance criteria:

- Must return metadata without needing a time range.
- Must not call historical telemetry tables.

### 3.2 `site_device_list`

Purpose: expose complete device inventory and tell AI what telemetry may be possible.

Pull from DB:

- Device table.
- Meter table.
- Building-device mapping table.
- Device communication/status table.
- Latest telemetry timestamp table or last-seen table.
- Device capability/metric mapping table, if available.

Required fields per device:

- `device_id`
- `device_name`
- `device_type`
- `site_id`
- `building_id`
- `building_name`
- `status`
- `data_status`
- `last_seen`
- `age_seconds`
- `expected_interval_seconds`
- `freshness_threshold_seconds`

Recommended fields per device:

- `is_meter`
- `is_virtual`
- `is_main_meter`
- `is_sub_meter`
- `parent_device_id`
- `manufacturer`
- `meter_model`
- `serial_number`
- `communication_protocol`
- `phase_count`
- `supported_metrics[]`
- `supported_tools[]`
- `tags[]`

Important improvement:

Add `supported_metrics[]`, for example:

```json
["energy", "voltage_l1", "voltage_l2", "voltage_l3", "current_l1", "current_l2", "current_l3", "power_factor", "frequency", "thd_voltage"]
```

Acceptance criteria:

- AI can choose a suitable device for voltage/current testing from this tool alone.
- Offline/stale devices are clearly marked.

### 3.3 `meter_status_summary`

Purpose: summarize device communication health.

Pull from DB:

- Device table.
- Latest telemetry/heartbeat table.
- Expected reporting interval configuration.
- Alarm/status table if offline status is alarm-derived.

Required fields:

- `online_count`
- `offline_count`
- `stale_count`
- `unknown_count`
- `devices[]`

Required fields per device:

- `device_id`
- `device_name`
- `status`
- `data_status`
- `last_seen`
- `age_seconds`
- `reason`

Recommended fields:

- `offline_duration_seconds`
- `last_successful_metric`
- `recommended_action`
- `severity`

Acceptance criteria:

- Counts must reconcile with the returned `devices[]`.
- Status logic must be documented: online vs stale vs offline vs unknown.

### 3.4 `active_alarm_summary`

Purpose: list active/open alarms.

Pull from DB:

- Alarm event table.
- Alarm definition table.
- Device table.
- Building table.
- Acknowledgement/status table.

Required fields:

- `active_count`
- `critical_count`
- `warning_count`
- `alarms[]`

Required fields per alarm:

- `alarm_event_id`
- `alarm_id`
- `alarm_name`
- `severity`
- `status`
- `device_id`
- `device_name`
- `building_id`
- `building_name`
- `started_at`

Recommended fields:

- `acknowledged_at`
- `cleared_at`
- `duration_seconds`
- `category`
- `related_metric`
- `threshold`
- `latest_value`
- `recommended_action`

Acceptance criteria:

- Active alarms should not include cleared alarms unless explicitly requested.
- Severity labels should be consistent.

### 3.5 `alarm_frequency_summary`

Purpose: rank historical alarms by frequency.

Current issue: returns values like `Alarm - not available occurrence(s)`, which means alarm name/type mapping is incomplete.

Pull from DB:

- Alarm event history table.
- Alarm definition table.
- Device table.

Required fields per row:

- `alarm_name`
- `alarm_type`
- `count`
- `severity`
- `first_seen`
- `last_seen`

Recommended fields:

- `device_id`
- `device_name`
- `building_id`
- `building_name`
- `duration_total_seconds`
- `active_count`
- `cleared_count`
- `acknowledged_count`

Acceptance criteria:

- No row should return `alarm_name` as null/unknown when alarm id exists.
- Results must be grouped by alarm type/name and sorted by count descending.

### 3.6 `alarm_detail_lookup`

Purpose: retrieve one alarm event with enough evidence for explanation.

Pull from DB:

- Alarm event table.
- Alarm definition table.
- Device table.
- Telemetry around alarm timestamp if available.

Required fields:

- `alarm_event_id`
- `alarm_id`
- `alarm_name`
- `status`
- `severity`
- `device_id`
- `device_name`
- `started_at`
- `ended_at`
- `acknowledged_at`

Recommended fields:

- `trigger_condition`
- `threshold`
- `trigger_value`
- `unit`
- `related_metric`
- `history_before_alarm[]`
- `history_after_alarm[]`

Acceptance criteria:

- If alarm id is not found, return `INVALID_ALARM`, not generic 400.
- Include accepted identifier type: `alarm_id` vs `alarm_event_id`.

### 3.7 `site_energy_summary`

Purpose: site-level kWh trend and totals.

Pull from DB:

- Energy telemetry table.
- Meter/device mapping table.
- Aggregated daily/hourly energy table if available.

Required fields:

- `total_kwh`
- `unit`
- `buckets[]`

Required fields per bucket:

- `timestamp` or `date`
- `start_time`
- `end_time`
- `value`
- `unit`
- `coverage_percent`
- `sample_count`
- `is_partial`

Recommended fields:

- `source_meter_count`
- `estimated`
- `missing_intervals[]`
- `complete_local_day`

Acceptance criteria:

- Avoid duplicate dates unless one is marked as partial and one complete.
- Clearly exclude current partial day unless requested.

### 3.8 `device_energy_breakdown`

Purpose: energy contribution by device; also fallback for top consumers.

Pull from DB:

- Energy telemetry table.
- Device table.
- Building mapping table.
- Aggregated device energy table if available.

Required fields:

- `total_kwh`
- `unit`
- `devices[]`

Required fields per device:

- `rank`
- `device_id`
- `device_name`
- `building_id`
- `building_name`
- `total_kwh`
- `unit`
- `percent_of_total`
- `coverage_percent`
- `sample_count`
- `data_status`

Recommended fields:

- `first_reading`
- `last_reading`
- `delta_kwh`
- `first_timestamp`
- `last_timestamp`
- `is_estimated`

Acceptance criteria:

- Must support site-level query with only `site_id`, `start`, and `end`.
- Must sort by `total_kwh` descending unless requested otherwise.

### 3.9 `telemetry_top_consumers`

Purpose: direct ranked energy-consuming devices.

Current issue: returns `DAXVIEW_UNAVAILABLE` or 404.

Pull from DB:

- Same source as `device_energy_breakdown`.
- Device table.

Required fields per row:

- `rank`
- `device_id`
- `device_name`
- `total_kwh`
- `unit`
- `building_id`
- `building_name`
- `coverage_percent`
- `sample_count`
- `data_status`

Recommended fields:

- `first_reading`
- `last_reading`
- `delta_kwh`
- `last_seen`
- `peak_kw_if_available`

Acceptance criteria:

- If this cannot be implemented separately, make it call the same backend service as `device_energy_breakdown`.
- Do not return 404 for an allowlisted tool.

### 3.10 `telemetry_timeseries`

Purpose: device-level telemetry for energy, voltage, current, demand, power quality, and other metrics.

Pull from DB:

- Raw telemetry/time-series table.
- Aggregated telemetry table if raw data is too large.
- Device metric mapping table.
- Unit/engineering mapping table.

Input should support:

- `site_id`
- `building_id`
- `device_id`
- `metric`
- `phase`
- `start_time`
- `end_time`
- `bucket`
- `aggregation`
- `limit`

Supported metric families should include, where available:

- `energy`
- `power`
- `demand`
- `voltage`
- `voltage_l1`
- `voltage_l2`
- `voltage_l3`
- `voltage_l12`
- `voltage_l23`
- `voltage_l31`
- `current`
- `current_l1`
- `current_l2`
- `current_l3`
- `power_factor`
- `frequency`
- `active_power`
- `reactive_power`
- `apparent_power`
- `thd`
- `thd_voltage`
- `thd_current`
- `temperature`
- `humidity`
- `co2`
- `status`

Required fields per row:

- `timestamp`
- `value`
- `unit`
- `metric`
- `phase`
- `aggregation`
- `quality`
- `device_id`
- `device_name`

Required summary fields:

- `min`
- `max`
- `avg`
- `latest`
- `sample_count`
- `coverage_percent`
- `first_timestamp`
- `last_timestamp`

Acceptance criteria:

- If metric is unsupported, return `UNSUPPORTED_METRIC` and include `supported_metrics[]`.
- If device has no rows, return `NO_DATA`.
- Never silently substitute another metric.

### 3.11 `data_availability_summary`

Purpose: tell AI what data exists before requesting detailed telemetry.

Pull from DB:

- Telemetry/time-series table.
- Metric catalog/mapping table.
- Device table.

Input should support:

- `site_id`
- `building_id`
- `device_id`
- `metric` optional
- `start_time`
- `end_time`

Required output if metric is supplied:

- `metric`
- `available`
- `coverage_percent`
- `sample_count`
- `first_timestamp`
- `last_timestamp`
- `missing_intervals[]`

Required output if metric is omitted:

- `metrics[]`

Each metric row:

- `metric`
- `unit`
- `available`
- `coverage_percent`
- `sample_count`
- `first_timestamp`
- `last_timestamp`
- `reason_if_unavailable`

Acceptance criteria:

- This tool should answer: “What can I ask for this device?”
- It should be the source of truth for voltage/current availability.

### 3.12 `demand_peak_summary`

Purpose: peak/max demand in kW.

Pull from DB:

- Demand telemetry table if separate.
- Active power telemetry table if demand is derived.
- Aggregated demand interval table if available.
- Meter/device mapping table.

Required fields:

- `peak_kw`
- `peak_time`
- `unit`
- `scope`
- `site_id`
- `building_id`
- `device_id`
- `source_device_id`
- `source_device_name`

Recommended fields:

- `latest_kw`
- `average_kw`
- `min_kw`
- `sample_count`
- `coverage_percent`
- `top_peak_periods[]`

Acceptance criteria:

- If demand is not stored or derivable, return `UNSUPPORTED_METRIC`.
- If no readings exist in the window, return `NO_DATA`.
- Do not return generic 404.

### 3.13 `power_quality_summary`

Purpose: power-quality events and metrics.

Pull from DB:

- Power-quality event table.
- Voltage/current telemetry.
- THD/power factor/frequency telemetry.
- Alarm/event table if PQ events are alarm-backed.

Required summary fields:

- `voltage_sag_count`
- `voltage_swell_count`
- `undervoltage_count`
- `overvoltage_count`
- `thd_voltage_avg`
- `thd_current_avg`
- `power_factor_avg`
- `frequency_avg`
- `unbalance_percent`

Required event fields:

- `event_id`
- `event_type`
- `device_id`
- `device_name`
- `phase`
- `severity`
- `start_time`
- `end_time`
- `value`
- `threshold`
- `unit`

Acceptance criteria:

- Must support sag, swell, THD, power factor, frequency, and phase imbalance when source data exists.

### 3.14 `energy_comparison_summary`

Purpose: compare two energy periods.

Pull from DB:

- Same source as `site_energy_summary`.
- Aggregated energy table if available.

Required fields:

- `period_a_start`
- `period_a_end`
- `period_b_start`
- `period_b_end`
- `period_a_kwh`
- `period_b_kwh`
- `difference_kwh`
- `difference_percent`
- `coverage_a_percent`
- `coverage_b_percent`

Recommended fields:

- `daily_breakdown[]`
- `device_breakdown_delta[]`

Acceptance criteria:

- Return clear period labels.
- Flag low coverage before comparing.

### 3.15 `tariff_cost_summary`

Purpose: estimate or report energy cost.

Pull from DB:

- Tariff profile table.
- Site tariff assignment table.
- Energy telemetry/aggregates.
- Demand charge data if applicable.

Required fields:

- `currency`
- `total_cost`
- `total_kwh`
- `tariff_name`
- `period_start`
- `period_end`
- `estimated_or_actual`

Recommended fields:

- `energy_charge`
- `peak_charge`
- `off_peak_charge`
- `demand_charge`
- `tax`
- `rate_components[]`

Acceptance criteria:

- If no tariff is configured, return `NO_TARIFF_CONFIGURED`, not 404.

### 3.16 `anomaly_detection_summary`

Purpose: identify abnormal usage or readings.

Pull from DB:

- Energy telemetry.
- Device telemetry.
- Baseline/forecast table if available.
- Alarm/event table if anomalies are event-backed.

Required fields:

- `anomalies[]`
- `baseline`
- `method`

Each anomaly:

- `timestamp`
- `device_id`
- `device_name`
- `metric`
- `actual_value`
- `expected_value`
- `difference`
- `difference_percent`
- `severity`
- `reason`

Acceptance criteria:

- Must explain method: threshold, baseline, z-score, same-day average, etc.
- Do not invent cause.

### 3.17 `report_summary`

Purpose: combined EMS report.

This should not be a black-box paragraph. Return structured sections:

```json
{
  "energy": {},
  "top_consumers": [],
  "alarms": {},
  "meter_status": {},
  "demand": {},
  "power_quality": {},
  "anomalies": [],
  "recommendations": []
}
```

Pull from DB:

- Reuse backend services for energy, devices, alarms, meter status, demand, PQ, and anomalies.

Acceptance criteria:

- If one section fails, return partial report with `section_errors[]`.
- Do not fail the entire report because one sub-section is unavailable.

## 4. New MCP Tools Recommended

### 4.1 `telemetry_metric_catalog`

This is the most important missing tool.

Purpose: let AI know what telemetry is available per site/device before asking for voltage/current/demand.

Input:

- `site_id`
- `building_id` optional
- `device_id` optional
- `start_time` optional
- `end_time` optional

Pull from DB:

- Device table.
- Metric mapping table.
- Telemetry table grouped by device and metric.
- Unit mapping table.

Required output:

```json
{
  "site_id": 17,
  "devices": [
    {
      "device_id": 519,
      "device_name": "AC kWh",
      "device_type": "Virtual",
      "available_metrics": [
        {
          "metric": "energy",
          "unit": "kWh",
          "available": true,
          "first_timestamp": "2026-09-01T00:00:00+08:00",
          "last_timestamp": "2026-10-07T10:00:00+08:00",
          "sample_count": 1234,
          "coverage_percent": 98.5
        }
      ]
    }
  ]
}
```

Questions this enables:

- Which devices support voltage?
- Which devices support current?
- Which metrics can I ask for this site?
- Why is voltage unavailable for this device?

### 4.2 `latest_telemetry_snapshot`

Purpose: get latest readings for one device or site.

Input:

- `site_id`
- `building_id` optional
- `device_id` optional
- `metrics[]` optional

Pull from DB:

- Latest telemetry table/materialized view.
- Device table.
- Unit mapping table.

Required output:

- `device_id`
- `device_name`
- `timestamp`
- `metric`
- `value`
- `unit`
- `phase`
- `quality`
- `status`

Questions this enables:

- What is the latest voltage?
- What is the latest current?
- Is the device reporting now?
- What are the latest readings for this meter?

## 5. Priority Fix List

Priority 1:

- Implement `telemetry_metric_catalog`.
- Fix `telemetry_timeseries` for energy, voltage, current, power factor, frequency, THD, demand.
- Fix `data_availability_summary`.
- Fix `device_energy_breakdown`.

Priority 2:

- Fix `telemetry_top_consumers`.
- Fix `demand_peak_summary`.
- Fix `alarm_frequency_summary` field mapping.
- Fix `energy_comparison_summary`.

Priority 3:

- Improve `power_quality_summary`.
- Improve `tariff_cost_summary`.
- Improve `report_summary`.
- Add `latest_telemetry_snapshot`.

## 6. Developer Acceptance Tests

For site `17`, each tool should be tested with:

- Valid site.
- Valid building where available.
- Valid online/fresh device.
- Offline/stale device.
- Time range with data.
- Time range with no data.
- Unsupported metric.
- Unauthorized site/device.

Minimum success criteria:

- No allowlisted tool should return generic 404.
- No tool should return vague `DAXVIEW_UNAVAILABLE` when a clearer error exists.
- Every successful tool should return structured `data` and `metadata`.
- Every row should contain enough IDs and names for the chatbot to cite the source.
- Every telemetry tool should return units.
- Every time-series tool should return coverage and sample count.

## 7. Summary For Developers

The chatbot needs a broad EMS data surface from MCP. The most important missing piece is discoverability: before asking for voltage/current/demand, the AI needs to know which devices and metrics are available. Add `telemetry_metric_catalog`, strengthen `telemetry_timeseries`, and make every tool return stable structured JSON with clear error codes. Once MCP exposes reliable fields, the AI Server can route questions correctly and avoid guessing.
