# DaxView MCP Tool Test Matrix

Use this file to test each MCP tool independently from the AI chat UI.

For every test, check the debug dashboard:

```text
http://<devaisvr-ip>:8091/debug/ai
```

Expected dashboard flow:

```text
daxview_data_plan_request -> mcp_tool_request -> mcp_tool_response -> mcp_answer_refine_request -> message
```

## Independent Tool Tests

| # | MCP tool | Test prompt | Expected result |
|---|---|---|---|
| 1 | `site_metadata_summary` | `What site am I currently viewing? Show site name, site id, building count, device count, and meter count.` | Site details only. |
| 2 | `site_device_list` | `List all devices under this site with their online, offline, or unknown status.` | Device list and status counts. |
| 3 | `active_alarm_summary` | `How many active alarms are there right now for this site? Show severity and latest alarms.` | Active alarm count and latest alarm examples. |
| 4 | `meter_status_summary` | `Which meters are offline, stale, or not reporting right now?` | Meter status counts and devices needing attention. |
| 5 | `site_energy_summary` | `Show the site energy summary for the last 7 days with daily values.` | Daily kWh summary and chart payload. |
| 6 | `telemetry_top_consumers` | `Which devices consumed the most energy in the last 7 days? Show top 5.` | Ranked device energy consumers and chart payload. |
| 7 | `alarm_frequency_summary` | `What are the most frequent alarms for this site in the last 7 days?` | Alarm counts/frequency and chart payload. |
| 8 | `telemetry_timeseries` | `Show voltage trend for device ID 380 for the last 24 hours.` | Time-series values for the device. |
| 9 | `energy_comparison_summary` | `Compare energy usage between today and yesterday for this site.` | Period comparison and difference. |
| 10 | `data_availability_summary` | `Check energy data availability for this site for the last 7 days.` | Data coverage/missing data. |
| 11 | `alarm_detail_lookup` | `Show details for alarm ID 123.` | Alarm details. Replace `123` with a real alarm id. |
| 12 | `power_quality_summary` | `Show the power quality summary for this site in the last 7 days, including voltage sag, swell, THD, and power factor if available.` | PQ summary. |
| 13 | `demand_peak_summary` | `What is the max demand today for this site? Include timestamp and kW if available.` | Peak/max demand answer and chart payload. |
| 14 | `tariff_cost_summary` | `Show the electricity cost summary for this site this month.` | Cost/tariff summary. |
| 15 | `device_energy_breakdown` | `Show the device energy breakdown for this site.` | Device contribution breakdown. |
| 16 | `energy_forecast` | `Forecast energy usage for the next 7 days for this site.` | Forecast answer and chart payload. |
| 17 | `anomaly_detection_summary` | `Detect abnormal energy behavior for this site in the last 7 days.` | Abnormal usage summary. |
| 18 | `report_summary` | `Generate a weekly EMS report for this site including energy, alarms, meter status, and demand.` | Management-style report. |

## Multi-Tool Tests

| Scenario | Test prompt | Expected tools |
|---|---|---|
| Site health | `Give me a complete site health summary: active alarms, offline meters, max demand, top consumers, and abnormal energy behavior for the last 7 days.` | `active_alarm_summary`, `meter_status_summary`, `demand_peak_summary`, `telemetry_top_consumers`, `anomaly_detection_summary` |
| Demand investigation | `Show me today's site max demand in kW. If available, include timestamp, meter source, and list devices I should inspect.` | `demand_peak_summary`, `site_device_list` |
| Energy + alarms | `Compare this week and last week energy usage, then show the most frequent alarms during the same period.` | `energy_comparison_summary`, `alarm_frequency_summary` |
| Reporting | `Create an operator report for this site for the last 7 days: energy, top consumers, alarms, offline meters, and next actions.` | `report_summary` or multiple summary tools |

## Follow-Up Tests

Ask one normal tool question first, then try:

```text
Reply to this answer: make it shorter and tell me what to check first.
```

```text
Follow up: explain why these devices matter.
```

```text
Based on the previous answer, show only critical items.
```

```text
Use previous answer and convert the energy values to MWh.
```

## What To Record

For every question, record:

```text
Prompt:
Expected tool:
Actual tool:
MCP request accepted? yes/no
MCP response has data? yes/no
AI answer quality: good/ok/bad
Chart payload present? yes/no
Issue:
Next fix:
```

