# Chatbot Weekly Work Summary

**Reporting period:** 12–16 October 2026  
**Scope reviewed:** Git history in `AI-Server` and `Chatbot-UI` for this period.

This summary groups the changes by outcome instead of listing every small fix commit. Commit messages in the period are often generic, so the descriptions below are based on the code and documentation changes.

## Major changes

### 1. Improved historical telemetry answers and visual output

- Expanded generation of chart summaries, time-series labels, and data tables from historical MCP results.
- Added table shaping for site summaries, device energy rankings, maximum demand, alarms, and site metadata.
- Improved handling of different table row and column formats so values map to readable cells.
- Added chart and table details to the AI Server debug outcome, including selected operations and sanitized arguments.
- Updated the Chatbot UI to render returned charts and tables within assistant messages, with a readable values view for charts.

### 2. Improved device-name resolution and clarification

- Made the planner treat names containing digits (for example, model-like or underscored device names) as names rather than numeric IDs.
- Improved matching of user-entered device names against authorized inventory, including readable candidate choices when a name is ambiguous or not an exact match.
- Added follow-up clarification handling so a user's answer can resume the original request with saved context.
- Documented the clarification request fields and how the frontend should link a reply to the clarification turn.

### 3. Improved multi-turn follow-up behavior

- Added handling for follow-up questions that ask for a device-level breakdown of a previous site energy total, reusing the same site and time range.
- Improved continuation of answers across turns and handling of turns that DaxView reports as no longer active (`TURN_NOT_ACTIVE`).
- Added response guidance to avoid substituting an inventory answer when a named-device telemetry query fails.

### 4. Added maximum-demand answers and rankings

- Expanded maximum-demand handling to support ranking devices and producing chart/table output.
- Added a calculation path that converts known interval energy deltas to interval-average demand when units and bucket duration are available.
- Added reporting for scanned, eligible, excluded, or truncated devices/readings so ranking limitations can be surfaced.
- Extended tests for energy-based demand peak calculations.

### 5. Improved diagnostics and trace usability

- Updated the debug dashboard to render answers and generation details in a more readable form.
- Improved loading, pagination, ordering, and merging of trace groups, including protection against stale concurrent loads.
- Added trace persistence and clarification database migration support during this work period.

### 6. Documented the data contract and RAG preparation roadmap

- Expanded `AI_SERVER_FRONTEND_DATA_CONTRACT.md` with the integration flow, message payload, chart/table expectations, clarification flow, and troubleshooting notes.
- Added the AI Server RAG roadmap and diagram, covering taxonomy, interaction records, review states, and controlled preparation of a knowledge corpus.
- Added EMS/MCP handoff and system-flow documentation in the Chatbot UI repository.

## Minor fixes and refinements

- Tightened intent routing for site energy totals versus device energy rankings.
- Improved alarm summaries with device names, first/latest occurrence, lifecycle counts, and ranking order.
- Refined chart timestamps for the configured display timezone and sorted telemetry points chronologically.
- Clarified rules against treating cumulative energy registers as interval consumption or inventing unsupported metric semantics.
- Improved answer wording to use valid site-specific data instead of asking for clarification unnecessarily.
- Fixed table preview handling for aliases, nested rows, missing values, and common telemetry fields.
- Added and adjusted tests for clarification helpers, planner memory, MCP manifest behavior, and prediction calculations.

## Week at a glance

The work focused on making the chatbot more reliable for EMS data questions: identifying the intended device and metric, asking a useful follow-up when needed, carrying context into the next turn, and presenting returned data as readable answers, tables, and charts. Diagnostic views and integration documentation were also expanded to make these flows easier to inspect and maintain.


## Manual chatbot test checklist

Use a site with the relevant devices and data. Replace bracketed values with names, metrics, or dates available in your test environment. Mark each item after checking the answer, any chart/table, and (where relevant) the debug trace.

| Done | Flow | Test prompt / action | Check |
|---|---|---|---|
| [ ] | Site energy chart | ?Show daily site energy for the last 7 days as a chart.? | Answer covers the requested period; chart labels and values are present and readable; chart values can be opened. |
| [ ] | Table output | ?List active alarms for this site in a table.? | Table has readable columns and populated cells; zero and missing values display sensibly. |
| [ ] | Combined report | ?Give me a short site energy and active alarm report for the last 7 days.? | Answer includes both requested topics and presents any returned chart/table clearly. |
| [ ] | Named device reading | ?Show energy readings for [exact device name] from [start date] to [end date].? | Uses the named device, metric, and period; does not answer with a device inventory instead. |
| [ ] | Device name with digits | Repeat the named-device request using a real device name containing numbers or underscores. | Treats the full name as a device name, not as a numeric device ID. |
| [ ] | Ambiguous device clarification | Ask for a metric and period but use a partial or ambiguous device name. Reply with the intended device name when asked. | Asks a focused follow-up, shows readable candidates when available, then resumes with the original metric and period. |
| [ ] | Missing details | ?Show readings for [device name].? | Asks for the missing metric and/or time range instead of guessing. |
| [ ] | Energy follow-up | Ask for site energy over a period, then: ?Break that down by device.? | Keeps the same site and period and returns a device-level breakdown. |
| [ ] | Device energy ranking | ?Which devices used the most energy over the last 7 days?? | Returns a ranking with device names, comparable values, and units; does not confuse it with a site total. |
| [ ] | Maximum demand | ?What was the highest maximum demand for [device name] last week?? | Returns demand in a clear unit and includes peak time if available. |
| [ ] | Site maximum-demand ranking | ?Rank devices by peak demand for the last 7 days.? | Ranking/chart/table is readable; any excluded or truncated devices are disclosed when applicable. |
| [ ] | No matching device | Ask for a telemetry reading using a clearly nonexistent device name. | Says it cannot resolve the device and asks for a more specific/correct name; does not invent readings. |
| [ ] | Debug trace | Run one successful chart/table query and inspect its trace in the debug dashboard. | Trace shows the answer and generation details; chart/table counts and selected operations are inspectable. |

### Record a result

For each failed item, note the prompt, expected behavior, actual behavior, approximate time, and the corresponding request/trace ID if available. Use real device names and periods supported by your test site; chart/table availability depends on the MCP data and chart configuration.

## Notes on scope

- The dates above follow the repositories' commit dates and include work through 16 October 2026; no later dated commits appeared in the inspected histories.
- The summary describes repository changes, not a deployment or production verification. It does not imply every change was released to users.
- The `v2` repository has a large working tree with many uncommitted changes and no corresponding committed history for this date range in the inspected output, so those files are not attributed to this chatbot weekly summary.
