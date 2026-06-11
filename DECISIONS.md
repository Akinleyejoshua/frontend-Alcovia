# Design Decisions & Sync Strategy

This document explains the data model, synchronization flow, conflict-resolution rules, and idempotency guarantees implemented in Alcovia.

## Data & Sync Model

We use a client-side log sync and merge strategy.
- **Tasks**: Tasks can be edited or deleted offline. Every task has a `rev` (revision counter) and `updatedBy` (client identifier) field.
- **Focus Sessions**: Focus sessions are immutable once completed or failed. They are assigned a random UUID on the client upon creation.
- **Stats**: Total coins, streak days, and today's focus minutes are derived dynamically on the server from the set of all successful focus sessions, and cached on the client.

## Conflict Resolution Approach

We use **Lamport Logical Revisions** for task status synchronization, rather than relying on wall-clock time (which is subject to clock drift).

### Tie-Breaker Logic
1. **Higher Revision Wins**: Every offline modification on a client increments the task's `rev` counter by 1. During synchronization, the server compares the incoming task's `rev` with the database task's `rev`.
2. **Lexicographical Client Tie-Breaker**: If two clients edit the same task offline starting from the same revision, both send the same incremented `rev`. The tie-breaker is resolved lexicographically based on `updatedBy` (`device_b` wins over `device_a`).

### Edited vs. Deleted Conflict
- A deletion is treated as a status change: we set `deleted: true` and increment the `rev` counter.
- If Device A deletes a task (incrementing `rev` to `N`), and Device B edits the task status (incrementing `rev` to `N`), the deletion status will propagate normally. If Device A deletes it at a higher revision, the deletion wins. If Device B edits it at a higher revision (e.g. they restore or modify it after deletion), the edit wins.

### Out of Order / Duplicate Sync Messages
- The synchronization operations are idempotent because we check the revisions. If a duplicate sync payload arrives, the revisions match the database, and the server ignores the duplicate. If an out-of-order sync payload arrives, the database will already have a higher revision, so the stale message is rejected.

---

## Idempotency Enforcement

### Backend (Rewards & Stats)
- Focus sessions are saved using a unique client-generated UUID as the key (`id`).
- When a sync request comes in, the server checks if the session ID already exists in MongoDB. Stale or duplicate sync retries for the same focus session will be ignored by the database.
- Student stats (coins, streak, minutes) are recalculated dynamically on the server over the unique, deduplicated list of successful sessions, preventing double-counting.

### n8n Webhook / Automation
- When a new successful focus session is synchronized to the database for the first time, the backend fires the webhook to the n8n endpoint.
- Inside the n8n workflow, the **"Get Existing Notifications"** HTTP request node queries the backend notification logs (`/api/notifications`) first.
- The **"Deduplicate Session ID"** JavaScript node compares the current webhook payload `id` against all previously logged session IDs.
- If it is a duplicate, n8n skips processing. If unique, n8n calls the mock WhatsApp notification sink, registering the session ID in the server log database, guaranteeing **exactly-once** execution.

---

## Technical Tradeoffs

### Tradeoff: Complete Client Replacements vs. Deltas/Diffs
- **Decision**: In `/api/sync`, the client sends its entire set of tasks and sessions to the server, and the server returns the complete merged state.
- **Why**: This significantly simplifies client/server states and guarantees eventual convergence without keeping complex delta histories. For a study app with relatively small data sizes (e.g. tens of tasks and sessions), full-state payload synchronization is highly efficient and robust. In production at scale, we would transition to sending only delta logs since the last synced checkpoint.
