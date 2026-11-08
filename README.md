# AI Customer Support Chat (E-commerce)

A clean and modern AI-assisted customer support chat system built for a single e-commerce store. It is developed using Node.js 24, Express 5, and Socket.IO following Clean Architecture principles.

---

## 1. Project Goal & Constraints

- **Goal:** Learn the architecture of building an AI chatbot for e-commerce customer support.
- **Learning Roadmap:** Socket.IO chat $\rightarrow$ Tool/Function Calling $\rightarrow$ RAG $\rightarrow$ LangChain.
- **Plain JavaScript (ESM):** Native Node.js 24 features (ESM, `--env-file`, `crypto.randomUUID`) without TypeScript or build tools.
- **Realtime Transport:** `socket.io` library (no unnecessary rooms, namespaces, or complexity).
- **No Database:** Local JSON files in the `data/` directory instead of an external database.
- **Minimal Noise:** Zero unnecessary third-party libraries or overly complex abstractions.

---

## 2. Architecture & Boundaries

- **`src/server.js`:** Creates the HTTP server and attaches both Express and Socket.IO.
- **`src/modules/chat/chat.socket.js`:** Socket event handlers. Manages handshake auth middleware (`io.use`), Zod validation, per-connection state on `socket.data` (`user`), and emitting events to the client. This is the **only** place with Socket.IO-specific code.
- **`src/modules/chat/chat.service.js`:** Domain chat service. A plain async function `getReply(text, user)`. It knows nothing about Socket.IO, HTTP, or Express; it interacts with the LLM and runs tool calling loops.
- **`src/infrastructure/`:** External adapters (e.g., `ollama.client.js`, `data-store.js`). Contains no business logic.
- **Express App:** Handles standard HTTP routes (e.g., `GET /home`).

---

## 3. Event Contract

### A. Authentication (Handshake - Not an Event)
The client passes a token upon connection: `io(url, { auth: { token } })`
- **No token:** Connection accepted as a guest (`socket.data.user = null`).
- **Valid token:** User data is saved (`socket.data.user = { id, name, email }`). The raw token is never stored in state.
- **Invalid token:** Connection rejected (`next(new Error('Invalid token'))`); the client receives a `connect_error` event.

### B. Client $\rightarrow$ Server
| Event | Payload | Description |
| :--- | :--- | :--- |
| `message` | `{ text }` | Chat message sent by the user |

### C. Server $\rightarrow$ Client
| Event | Payload | Description |
| :--- | :--- | :--- |
| `reply` | `{ text }` | Final reply processed by the model |
| `error` | `{ message }` | Sent on invalid payload, authentication error, or server failure |

---

## 4. Roadmap Status

1. [x] **Simple echo chat with auth middleware (no LLM)**
2. [x] **Reply from Ollama + system prompt (guest must log in for order/account questions)**
3. [ ] **Conversation history per connection**
4. [x] **Tool calling (login checked in code, not only in prompt)**
5. [ ] **RAG (return, refund, shipping policy)**
6. [ ] **Streaming replies**
7. [ ] **Minimal HTML client**
8. [ ] **LangChain**
9. [ ] **LangGraph**

---

## 5. File & Folder Structure

```text
ai-system-rag/
├── README.md
├── .env
├── .env.example
├── .gitignore
├── .nvmrc
├── .prettierrc
├── package.json
├── data/
│   ├── users.json          # Mock user accounts
│   ├── products.json       # Mock product catalog
│   ├── orders.json         # Mock orders
│   └── shipments.json      # Mock shipment tracking events
├── scripts/
│   └── test-client.js      # Socket.IO CLI test client
└── src/
    ├── app.js              # Express app configuration
    ├── server.js           # HTTP + Socket.IO server entrypoint
    ├── config/
    │   └── index.js        # Zod environment variable validation
    ├── infrastructure/
    │   ├── data-store.js   # JSON data access helpers
    │   ├── errors.js       # Custom AppError classes
    │   ├── logger.js       # Pino logger instance
    │   └── ollama.client.js # Ollama LLM client
    ├── middleware/
    │   ├── error-handler.js # Central error handler
    │   └── http-logger.js   # HTTP logger middleware
    └── modules/
        └── chat/
            ├── chat.prompts.js # System prompts and instructions
            ├── chat.service.js # Chat service and tool calling loop
            ├── chat.socket.js  # Socket.IO connection and message handlers
            └── chat.tools.js   # Read-only tools definitions, validation, and runner
```

---

## 6. Getting Started & Testing

### Start the Server:
```bash
npm run dev
```

### Run the CLI Test Client (`scripts/test-client.js`):

1. **Guest User Chat:**
```bash
node scripts/test-client.js "Hello support"
```

2. **Logged-in User (Alice) Chat:**
```bash
node scripts/test-client.js token-alice "Track my order"
```

3. **Invalid Token Test (Handshake failure):**
```bash
node scripts/test-client.js wrong-token "Hello"
```
