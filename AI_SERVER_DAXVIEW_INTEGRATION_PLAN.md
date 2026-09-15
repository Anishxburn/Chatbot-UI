# AI Server Plan for Daxview Integration

## Scope

This document covers only the AI server/chatbot work owned in:

```text
C:\chatbot-stack\AI-Server
C:\chatbot-stack\Chatbot-UI
```

It does not include Daxview V2 frontend, Django backend, Daxview MCP server,
Daxview database schema, Daxview RBAC, or customer production rollout work.
Daxview is treated as an external system that already exposes a fixed contract.

Your job is to make the AI server accept Daxview chat requests, manage
conversation history, run model/RAG logic, request approved Daxview historical
data when needed, and return ordered answer events back to Daxview.

## Target System Summary

The AI server must become the external service behind:

```text
https://ai.daxview.com
```

Daxview will call the AI server using this route namespace:

```text
/v1/integrations/daxview/*
```

The normal flow is:

```text
Daxview browser
  -> Daxview /api/ai endpoints
  -> AI server /v1/integrations/daxview/*
  -> AI model and conversation store
  -> AI job events
  -> Daxview
  -> browser
```

When historical Daxview data is required:

```text
Daxview browser
  -> Daxview /api/ai endpoints
  -> AI server
  -> AI asks Daxview for a data authorization
  -> Daxview returns authorization_id
  -> AI calls Daxview MCP with that authorization_id
  -> MCP returns bounded historical data
  -> AI summarizes result
  -> Daxview
  -> browser
```

The AI server must not receive browser cookies, Daxview database credentials,
Redis credentials, InfluxDB credentials, MQTT credentials, or unrestricted
Django API credentials.

## Existing Local Starting Point

Current local stack:

```text
C:\chatbot-stack\AI-Server\server.py
C:\chatbot-stack\Chatbot-UI\docker-compose.yml
```

Current AI server behavior is closer to a proof of concept:

- local chatbot UI on `http://127.0.0.1:8085/`
- multi-agent POC on `http://127.0.0.1:8091/`
- endpoint `POST /multi-agent-chat`
- local Ollama models
- PostgreSQL + pgvector for RAG and Q&A logging
- optional direct Daxview MCP settings through:
  - `DAXVIEW_MCP_ENABLED`
  - `DAXVIEW_MCP_URL`
  - `DAXVIEW_MCP_AUTH_TOKEN`

What is missing for Daxview compatibility:

- Daxview route namespace `/v1/integrations/daxview/*`
- service-key validation
- signed assertion validation
- Daxview-compatible conversation APIs
- async job IDs and ordered event polling
- cancellation
- lifecycle deletion
- per-deployment registry
- Daxview data-plan callback before MCP
- approved historical-only MCP tool flow
- strict log redaction and contract-safe errors

## AI Server Responsibilities

### 1. Daxview Integration API

Implement these AI-server endpoints.

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/v1/integrations/daxview/conversations` | Create a conversation |
| `GET` | `/v1/integrations/daxview/conversations` | List conversations for signed user |
| `GET` | `/v1/integrations/daxview/conversations/{conversation_id}/turns` | Load conversation turns |
| `PATCH` | `/v1/integrations/daxview/conversations/{conversation_id}` | Rename conversation |
| `DELETE` | `/v1/integrations/daxview/conversations/{conversation_id}` | Delete conversation |
| `POST` | `/v1/integrations/daxview/conversations/{conversation_id}/turns` | Accept a user turn |
| `GET` | `/v1/integrations/daxview/jobs/{job_id}/events` | Return ordered job events |
| `POST` | `/v1/integrations/daxview/jobs/{job_id}/cancel` | Cancel an active job |
| `DELETE` | `/v1/integrations/daxview/lifecycle/user/{user_id}` | Delete one user's AI history |
| `DELETE` | `/v1/integrations/daxview/lifecycle/company/{company_id}` | Delete one company's AI history |
| `GET` | `/v1/integrations/daxview/health` | Protected readiness check |

### 2. Authentication

Every Daxview request must be authenticated with:

```http
Authorization: Bearer <AI_SERVER_API_KEY>
X-DaxView-Assertion: <signed JWT>
```

The AI server must verify:

- service API key is current or accepted previous key
- assertion signature is valid
- assertion algorithm is expected
- issuer/deployment is registered
- audience is `daxview-ai`
- expiry and issued-at are valid
- user/company/deployment claims are present
- conversation/turn binding is valid when supplied
- one deployment's assertion cannot be used with another deployment's key

The AI server must not trust user ID, company ID, or site ID from the request
body when ownership decisions should come from the signed assertion.

### 3. Deployment Registry

The AI server needs a protected registry per Daxview deployment.

Minimum fields:

| Field | Purpose |
| --- | --- |
| `deployment_id` | Example: `v2-dev`, `v2-staging`, `aryzta`, `utm` |
| `enabled` | Enables or disables that deployment |
| `assertion_audience` | Usually `daxview-ai` |
| `v2_to_ai_key_current` | Key Daxview sends to AI |
| `v2_to_ai_key_previous` | Optional rotation key |
| `assertion_secret` | Secret used to verify Daxview signed assertions |
| `v2_callback_base_url` | Daxview origin for data-plan callback |
| `v2_callback_key_current` | Key AI sends to Daxview callback |
| `v2_callback_key_previous` | Optional rotation key |
| `mcp_url` | Deployment-specific Daxview MCP URL |
| `mcp_key_current` | Key AI sends to MCP |
| `mcp_key_previous` | Optional rotation key |
| `manifest_version` | Expected Daxview AI capability manifest |
| `manifest_sha256` | Expected capability manifest hash |

For local development, this can start as environment variables or a protected
config table. For staging/production, it should be moved to a secret manager or
equivalent protected config store.

### 4. Conversation Store

The AI server is the system of record for conversation history.

Store conversations by:

```text
deployment_id + company_id + user_id + conversation_id
```

Recommended tables or records:

- deployments
- conversations
- turns
- job_events
- jobs
- clarification_state
- lifecycle_deletion_jobs
- optional model metadata

Do not store raw Daxview MCP payloads by default. Store the final answer and
compact provenance only.

Conversation list should return cursor-paginated summaries:

```json
{
  "items": [
    {
      "conversation_id": "uuid",
      "title": "Weekly energy usage",
      "created_at": "2026-09-15T10:00:00Z",
      "updated_at": "2026-09-15T10:05:00Z"
    }
  ],
  "next_cursor": null
}
```

Turn history should return bounded pages, ideally five turns at a time:

```json
{
  "conversation_id": "uuid",
  "items": [
    {
      "turn_id": "uuid",
      "created_at": "2026-09-15T10:02:00Z",
      "user_message": {
        "text": "Which devices used the most energy?"
      },
      "assistant_events": [
        {
          "type": "message",
          "text": "The highest usage devices were ..."
        }
      ]
    }
  ],
  "previous_cursor": null
}
```

### 5. Async Turn Processing

When Daxview sends a user turn:

```http
POST /v1/integrations/daxview/conversations/{conversation_id}/turns
```

Example request:

```json
{
  "turn_id": "uuid",
  "message": "Which five devices used the most energy this week?",
  "context": {
    "site_id": 7,
    "building_id": 12
  },
  "request_id": "uuid"
}
```

The AI server should immediately return:

```json
{
  "job_id": "job_uuid_or_safe_id"
}
```

Then process the turn in the background:

```text
1. Save user turn.
2. Create job.
3. Add status event.
4. Decide if answer is general, clarification, or Daxview-data-assisted.
5. Run model/RAG and optional MCP flow.
6. Add message/token events.
7. Add completed or failed terminal event.
```

Idempotency rule:

- same deployment + conversation + turn_id must return the same job
- retries must not create duplicate model runs

### 6. Job Event API

Daxview polls:

```http
GET /v1/integrations/daxview/jobs/{job_id}/events?after=12&limit=100
```

Return:

```json
{
  "events": [
    {
      "id": 13,
      "type": "status",
      "data": {
        "text": "Preparing response"
      }
    },
    {
      "id": 14,
      "type": "message",
      "data": {
        "text": "The highest usage devices are ..."
      }
    },
    {
      "id": 15,
      "type": "completed",
      "data": {
        "status": "completed"
      }
    }
  ]
}
```

Accepted event types:

- `status`
- `token`
- `message`
- `waiting_for_user`
- `completed`
- `failed`
- `cancelled`

Rules:

- event IDs must increase per job
- return only events where `id > after`
- keep events long enough for reconnect/retry
- terminal events must be stable
- never include chain-of-thought, credentials, raw MCP payloads, or internal
  model metadata

### 7. Clarification Flow

If the user asks a question that needs site/building/time context, the AI server
should not guess.

Return an event like:

```json
{
  "id": 21,
  "type": "waiting_for_user",
  "data": {
    "prompt": "Choose a site and time range.",
    "fields": ["site_id", "building_id", "time_range"]
  }
}
```

Daxview is responsible for showing authorized choices. The AI server should not
send its own site/building option list.

### 8. Daxview Data Flow

The AI server can answer general EMS questions without Daxview data.

Only when Daxview historical data is needed:

```text
1. AI chooses an approved operation.
2. AI builds exact arguments.
3. AI calls Daxview data-plan callback.
4. Daxview validates user/session/site/time range.
5. Daxview returns authorization_id and normalized arguments.
6. AI calls Daxview MCP with authorization_id.
7. AI summarizes MCP result.
```

Data-plan callback:

```http
POST https://<daxview-origin>/api/ai/integration/data-request-plans
Authorization: Bearer <AI_SERVER_CALLBACK_KEY>
Content-Type: application/json
Accept: application/json
```

Example body:

```json
{
  "turn_id": "uuid",
  "continuation_id": "ai-generated-continuation-id",
  "operation_id": "telemetry_top_consumers",
  "arguments": {
    "site_id": 7,
    "building_id": 12,
    "start": "2026-09-08T00:00:00+08:00",
    "end": "2026-09-15T00:00:00+08:00",
    "timezone": "Asia/Kuala_Lumpur",
    "limit": 5
  }
}
```

Use the returned normalized arguments exactly. Do not change them before MCP.

### 9. Approved MCP Tools

Only support these first three Daxview operations:

| Tool | Required arguments | Optional arguments |
| --- | --- | --- |
| `telemetry_top_consumers` | `authorization_id`, `site_id`, `start`, `end`, `timezone` | `building_id`, `limit` |
| `site_energy_summary` | `authorization_id`, `site_id`, `start`, `end`, `timezone` | `bucket` |
| `alarm_frequency_summary` | `authorization_id`, `site_id`, `start`, `end`, `timezone` | `building_id`, `limit` |

Do not expose:

- live/latest values
- Redis reads
- SQL
- arbitrary HTTP
- file access
- commands
- writes
- control actions
- subscriptions
- MQTT access
- direct DB access

### 10. Model and RAG Integration

The existing local AI flow can be reused after the Daxview API boundary is added.

Recommended internal pipeline:

```text
Incoming Daxview turn
  -> authenticate request
  -> save turn/job
  -> classify intent
  -> retrieve EMS knowledge from pgvector
  -> decide response path
      -> direct general answer
      -> clarification
      -> Daxview historical data-plan + MCP
  -> run model/final answer
  -> save events/history
  -> expose events to Daxview polling endpoint
```

The current multi-agent logic can remain useful, but it must sit behind the
Daxview-compatible async turn/event API.

## Environment Variables to Add or Confirm

AI server side:

```text
AI_SERVER_PUBLIC_BASE_URL=https://ai.daxview.com
AI_SERVER_API_KEY=
AI_SERVER_API_KEY_PREVIOUS=
AI_SERVER_AUDIENCE=daxview-ai
AI_CHAT_ASSERTION_SECRET=

DAXVIEW_DEPLOYMENT_ID=v2-dev
DAXVIEW_CALLBACK_BASE_URL=
DAXVIEW_CALLBACK_KEY=
DAXVIEW_CALLBACK_KEY_PREVIOUS=

DAXVIEW_MCP_ENABLED=true
DAXVIEW_MCP_URL=
DAXVIEW_MCP_AUTH_TOKEN=
DAXVIEW_MCP_AUTH_TOKEN_PREVIOUS=
DAXVIEW_MCP_PROTOCOL_VERSION=2025-06-18
DAXVIEW_MCP_TIMEOUT=20

DAXVIEW_CAPABILITY_MANIFEST_VERSION=2026-09-14
DAXVIEW_CAPABILITY_MANIFEST_SHA256=

DATABASE_URL=
CHAT_MODEL=
EMBEDDING_MODEL=
OLLAMA_URL=
```

Names can be adjusted to match the existing app style, but the concepts must be
present.

## Security Requirements

The AI server must:

- return JSON for all integration responses
- never redirect `/v1/integrations/daxview/*` to login
- reject missing/invalid keys
- reject invalid/expired/wrong-audience assertions
- scope conversations by deployment, company, and user
- redact API keys, assertions, authorization IDs, prompts, answers, and raw MCP
  results from logs
- avoid storing raw historical MCP results by default
- reject unknown operation IDs
- reject live/latest/write/control requests
- ensure cancellation prevents later MCP calls
- keep deployment credentials separate

## Error Response Shape

Use stable JSON errors:

```json
{
  "error": {
    "code": "conversation_not_found",
    "message": "The conversation is unavailable.",
    "retryable": false,
    "request_id": "uuid"
  }
}
```

Common statuses:

| Status | Use |
| --- | --- |
| `400` | Bad JSON or invalid request |
| `401` | Bad service key or assertion |
| `403` | Authenticated but not allowed |
| `404` | Conversation/job unavailable |
| `409` | Idempotency/cancellation conflict |
| `413` | Request/result too large |
| `422` | Invalid operation arguments |
| `429` | Rate limit |
| `502` | Invalid upstream/model response |
| `503` | Temporary AI/MCP/model unavailable |
| `504` | Timeout |

## Implementation Phases

### Phase 1: Contract and Code Mapping

Estimated duration: 1 day

Tasks:

- map current `server.py` routes and functions
- identify reusable pieces from `/multi-agent-chat`
- decide data model for conversations/jobs/events
- decide whether to keep one file temporarily or split into modules
- define local test fixtures for Daxview assertions

Deliverables:

- endpoint checklist
- DB table plan
- local fake Daxview request sample

### Phase 2: Storage Layer

Estimated duration: 1 day

Tasks:

- add conversation table/model
- add turn table/model
- add job table/model
- add job event table/model
- add lifecycle deletion status table/model if needed
- add helper functions for cursor pagination

Deliverables:

- conversations can be created/listed/renamed/deleted
- turns and events can be saved and loaded

### Phase 3: Authentication Layer

Estimated duration: 1 day

Tasks:

- implement service key validation
- implement signed JWT assertion validation
- load deployment config/registry
- bind identity to deployment/company/user
- reject wrong key/assertion combinations
- add safe error responses

Deliverables:

- unauthenticated requests fail with JSON `401`
- valid local test assertion passes
- invalid expiry/audience/signature fails

### Phase 4: Daxview Conversation API

Estimated duration: 1-2 days

Tasks:

- implement all conversation endpoints
- implement turn creation endpoint
- generate safe `job_id`
- enforce idempotency by deployment/conversation/turn
- implement event polling endpoint
- implement cancellation endpoint

Deliverables:

- Daxview can create a conversation
- Daxview can submit a turn
- Daxview receives a job ID
- Daxview can poll ordered events
- cancellation returns stable result

### Phase 5: Async Model Execution

Estimated duration: 1-2 days

Tasks:

- move existing multi-agent/RAG flow into background job execution
- save `status`, `message`, `completed`, and `failed` events
- handle model timeout/failure safely
- preserve request/turn/job correlation IDs
- add title generation after first meaningful turn

Deliverables:

- general questions complete without MCP
- events appear in correct order
- failed model calls produce safe `failed` events

### Phase 6: Clarification

Estimated duration: 0.5-1 day

Tasks:

- detect missing site/building/time range for data questions
- store outstanding clarification state
- return `waiting_for_user` event
- interpret next user turn in same conversation as clarification follow-up

Deliverables:

- ambiguous data question asks for missing fields
- AI does not create data authorization when context is missing

### Phase 7: Daxview Callback Client

Estimated duration: 1 day

Tasks:

- implement Daxview data-plan callback client
- send `Authorization: Bearer <AI_SERVER_CALLBACK_KEY>`
- send operation ID and exact arguments
- handle denial/timeout/retry safely
- keep authorization IDs out of logs

Deliverables:

- AI can request authorization from Daxview
- callback denial becomes safe user-facing limitation

### Phase 8: MCP Client

Estimated duration: 1-2 days

Tasks:

- implement MCP Streamable HTTP client or use an SDK
- initialize MCP session
- call `tools/list`
- call approved `tools/call`
- support only the three approved historical tools
- pass returned `authorization_id`
- handle MCP errors without broadening request

Deliverables:

- `telemetry_top_consumers` works through authorization flow
- `site_energy_summary` works through authorization flow
- `alarm_frequency_summary` works through authorization flow

### Phase 9: Security Hardening

Estimated duration: 1 day

Tasks:

- add log redaction
- verify no secrets in access/application logs
- enforce response size limits
- enforce operation allowlist
- enforce timeout and retry limits
- ensure cancellation prevents later MCP calls
- ensure raw MCP payloads are not persisted by default

Deliverables:

- security checklist passes
- bad requests fail closed

### Phase 10: Integration Testing

Estimated duration: 1-2 days

Tasks:

- test general question
- test conversation list/history pagination
- test rename/delete
- test top consumers
- test site energy summary
- test alarm frequency
- test clarification
- test cancellation
- test repeated same `turn_id`
- test invalid keys/assertions
- test invalid/reused/expired authorization
- test lifecycle deletion

Deliverables:

- dev/staging acceptance report
- known issues list
- production readiness recommendation

## Suggested Timeline

| Day | Focus | Output |
| --- | --- | --- |
| Day 1 | Contract mapping | Final endpoint/storage/auth plan |
| Day 2 | Storage | Conversation, turn, job, event persistence |
| Day 3 | Auth | Service key and assertion verification |
| Day 4 | API routes | Daxview conversation and job routes |
| Day 5 | Async AI | Model/RAG job execution and events |
| Day 6 | Clarification + callback | Missing-context flow and data-plan client |
| Day 7 | MCP | Approved MCP tool calls |
| Day 8 | Historical answers | Summaries using MCP results |
| Day 9 | Security | Redaction, limits, cancellation, lifecycle |
| Day 10 | Testing | Acceptance evidence and handoff |

For a safer production-quality version, plan 2-3 weeks instead of 10 working
days, especially if the deployment registry, async queue, and MCP client need to
be made robust rather than POC-grade.

## Priority Checklist

### Must Have

- `/v1/integrations/daxview/*` routes
- service key validation
- signed assertion validation
- scoped conversation storage
- async turn/job handling
- ordered job events
- cancellation
- direct general answers
- clarification event
- data-plan callback before MCP
- three approved historical MCP tools
- JSON error responses
- log redaction

### Should Have

- protected integration health endpoint
- deployment registry table/admin config
- current/previous key rotation support
- title generation
- cursor pagination
- lifecycle deletion retry queue
- metrics for request/job/model/MCP outcomes

### Later

- better model routing
- richer memory
- advanced evaluation suite
- provider fallback
- cost controls
- admin dashboard for AI jobs
- legal hold/export workflows

## Acceptance Criteria

The AI side is complete when:

- Daxview can create/list/rename/delete conversations
- Daxview can submit a turn and receive a job ID
- Daxview can poll ordered events until completion
- general EMS questions answer without MCP
- missing site/time context returns `waiting_for_user`
- historical data questions call Daxview callback before MCP
- MCP calls use only approved operation IDs and exact authorized arguments
- same `turn_id` retry returns the same job
- cancellation stops future model/MCP work
- lifecycle deletion removes scoped user/company history
- invalid keys and assertions fail with JSON, not redirects
- no secrets, authorization IDs, prompts, answers, or raw MCP results appear in
  logs
- production Daxview credentials are not reused across deployments

## Immediate Next Steps

1. Decide whether to refactor `server.py` into modules before adding Daxview
   routes.
2. Design the DB tables for conversations, turns, jobs, and events.
3. Add a local Daxview assertion test helper.
4. Implement auth middleware/helpers.
5. Implement conversation CRUD.
6. Implement async job/event flow.
7. Connect the existing model/RAG pipeline behind the new turn API.
8. Add callback and MCP client after the base chat path works.
