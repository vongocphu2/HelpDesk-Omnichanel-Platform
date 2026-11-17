# Sprint 5 — Corrections after review (18/11/2026)

Base: `89a056e` on `sprint-5-backend`.

## Changes

- Task 5.1: validate conversation `page` and `limit` as positive integers; limit is at most 100. Invalid inputs return HTTP 400 instead of an empty history caused by NaN.
- Task 5.3: share one gateway through `TicketsRealtimeModule`; authenticated staff automatically join `inbox`. Ticket subscriptions are rejected until authentication completes. Socket.IO room unions prevent duplicate events for clients subscribed to both inbox and a ticket.
- Emit inbound messages after Web intake finishes and after Email/Telegram transactions commit. Emit status, priority and assignment updates after commit. AI triage events use the values returned by the database update; unsuccessful conditional writes emit nothing.
- Task 5.4: resolve the singleton Email/Telegram adapters across module boundaries. Telegram HTTP failures, `ok:false`, network errors and timeouts propagate as delivery failures, without logging a bot token. Automatic acknowledgments are best effort and occur after commit.
- Integration correction for Task 5.2: Smart Reply respects the configured OpenAI/Gemini provider and rejects incomplete output. Task ownership remains Phú; no changes to the assignment workbook.
- The assignment modal continues using POST `/tickets/:id/assign-round-robin`. Removed the redundant conflicting PATCH decorator.

## Verification

From `backend`:

```sh
npm test
npm run build
node node_modules/typescript/bin/tsc --noEmit --incremental false
```

Regression coverage includes the real Nest module graph with stubbed database/channel boundaries, an actual local Socket.IO connection, invalid pagination, Telegram delivery failures, both AI response formats, transaction rollback and AI update races.

These tests do not send customer messages, call paid AI providers or modify a live PostgreSQL database. Deployment still needs the existing migrations and valid SMTP/Telegram/AI credentials. Frontend Socket.IO client work remains Task 5.6 owned by Phúc.

## Client contract

- Namespace `/ws`; pass JWT through Socket.IO `auth.token` (legacy query token and bearer header remain supported).
- Authenticated staff receive `message:new`, `ticket:updated` and `triage:completed` in `inbox` automatically.
- `join:ticket` / `leave:ticket` payload: `{ "ticket_id": "<UUID>" }`.
- Reply API response `delivered:false` means the message was stored but the external channel did not confirm delivery; the UI must display that result rather than rely only on HTTP 201.
