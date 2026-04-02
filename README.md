# Whatfix Discussion API

Production-grade Express.js messaging API with modular architecture, ESLint + Prettier, and full test coverage.

---

## Project Structure

```
src/
  config/        env.js, logger.js          – centralised config
  models/        User.js, Message.js        – schema + data classes
  services/      UserService.js             – CRUD for users
                 MessageService.js          – low-level message store
                 MessageFeedService.js      – sorted feed + dedup + retry
  controllers/   UserController.js          – request → service → response
                 MessageController.js
  middlewares/   requestLogger.js           – per-request timing log
                 validate.js                – express-validator aggregator
                 errorHandler.js            – central error formatter
                 notFound.js                – catch-all 404
  routes/        userRoutes.js              – validation chains + controller wiring
                 messageRoutes.js
  app.js                                   – Express app (no listen)
server.js                                  – process entry point
tests/
  services/      UserService.test.js
                 MessageService.test.js
                 MessageFeedService.test.js – feed, dedup, retry, idempotency
  middlewares/   validate.test.js
                 errorHandler.test.js
                 requestLogger.test.js
  controllers/   users.integration.test.js
                 messages.integration.test.js
```

---

## Quick Start

```bash
cp .env.example .env
npm install
npm run dev        # nodemon with hot-reload
```

### Run tests

```bash
npm test           # jest --coverage
npm run test:watch
```

### Lint / format

```bash
npm run lint
npm run lint:fix
npm run format
```

---

## Data Models

### User

| Field      | Type      | Constraints          | Index          |
|------------|-----------|----------------------|----------------|
| id         | UUID      | PK                   |                |
| name       | string    | required             |                |
| email      | string    | required, unique     | UNIQUE INDEX   |
| createdAt  | timestamp | auto                 | INDEX          |
| updatedAt  | timestamp | auto                 |                |

### Message

| Field      | Type      | Constraints                  | Index                                         |
|------------|-----------|------------------------------|-----------------------------------------------|
| id         | UUID      | PK                           |                                               |
| seq        | integer   | monotonic counter, auto      | implicit via PK ordering                      |
| senderId   | UUID      | FK → users.id                | part of composite                             |
| receiverId | UUID      | FK → users.id                | part of composite                             |
| content    | text      | required                     |                                               |
| status     | enum      | sent\|delivered\|read        | part of idx_receiver_status                   |
| timestamp  | timestamp | auto (message send time)     | INDEX idx_timestamp (timestamp DESC)          |
| createdAt  | timestamp | auto                         |                                               |
| updatedAt  | timestamp | auto                         | INDEX idx_updated_at (updatedAt DESC)         |

**DB indexes (apply at migration time)**:

```sql
-- Covers: "get conversation between A and B, newest first"
CREATE INDEX idx_conversation ON messages (senderId, receiverId, timestamp DESC);

-- Covers: "how many unread messages does this user have?"
CREATE INDEX idx_receiver_status ON messages (receiverId, status);

-- Covers: time-range scans
CREATE INDEX idx_timestamp ON messages (timestamp DESC);

-- Optional: polling for delivery-receipt updates
CREATE INDEX idx_updated_at ON messages (updatedAt DESC);
```

**Status state machine** — transitions are one-directional:

```
sent → delivered → read
```

Any backward transition is rejected at the service layer. Invalid status values are caught at the route layer with a 422.

---

## Services

### MessageFeedService — chronological feed with deduplication and retry

`src/services/MessageFeedService.js`

| Method | Description |
|---|---|
| `getChronologicalFeed(userA, userB, opts)` | Returns messages sorted oldest→newest. Deduplicates across both sender/receiver index directions. Supports `afterSeq` cursor for stable pagination. |
| `send({ senderId, receiverId, content, clientRequestId })` | Idempotent send — if `clientRequestId` is provided and a concurrent in-flight request with the same id exists, the second call returns the same promise without calling the store again. |
| `countUnread(receiverId)` | Unread count with retry. |
| `updateStatus(messageId, newStatus)` | Status update with retry. |

**Retry policy** (`withRetry`):
- 3 attempts by default
- Exponential backoff with jitter: `min(baseDelay × 2^(attempt-1) + jitter, 2000ms)`
- 4xx errors are **not retried** (client errors won't resolve on retry)

**Deduplication**:
- A `Set<id>` is built per call; any message already seen is skipped
- `afterSeq` cursor uses the monotonic `seq` field rather than `timestamp` to guarantee stable pagination even when multiple messages share the same millisecond

---

## Concurrency

The current in-memory store uses JavaScript's single-threaded event loop — no data races occur within a single process. The following patterns are in place for when the store is replaced with a real DB:

| Concern | How it is handled |
|---|---|
| Duplicate user email | Service checks for existing email; DB enforces UNIQUE INDEX |
| Duplicate message send | `clientRequestId` idempotency key in `MessageFeedService.send` |
| Backward status transition | Enforced in `Message.updateStatus()` with a state-machine check |
| Pagination stability | Monotonic `seq` field used as cursor; not timestamp (which is non-unique) |
| DB timeouts | `withRetry` wraps all service calls with exponential backoff |

---

## API Reference

### Users

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/users` | Create user |
| GET | `/api/users` | List all users |
| GET | `/api/users/:id` | Get user by UUID |
| PATCH | `/api/users/:id` | Update name and/or email |
| DELETE | `/api/users/:id` | Delete user |

### Messages

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/messages` | Send a message |
| GET | `/api/messages/:id` | Get message by UUID |
| GET | `/api/messages/conversation/:userA/:userB` | Get conversation (newest-first). Query: `limit` (1–200), `before` (ISO-8601) |
| GET | `/api/messages/unread/:receiverId` | Count unread messages for receiver |
| PATCH | `/api/messages/:id/status` | Update delivery status |

### Error responses

```json
{
  "error": {
    "status": 422,
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "valid email is required" }
    ]
  }
}
```

| Status | Cause |
|--------|-------|
| 422 | Validation failure (missing/invalid fields, invalid status transition) |
| 409 | Conflict (duplicate email) |
| 404 | Resource not found |
| 500 | Unhandled server error (stack trace included in non-production) |

---

## Postman Collection

Import `postman_collection.json`. Requests are ordered so that variables are automatically chained:

1. **Create user** → saves `userId`
2. **Create second user** → saves `userId2`
3. **Send message** → saves `messageId`
4. All subsequent requests use those saved variables automatically

Every edge case (422 missing field, 409 duplicate, 404 not found, backward status transition, invalid status value, limit out of range) is included as a separate request with inline Postman test assertions.
