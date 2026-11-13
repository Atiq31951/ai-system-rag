# Production Best Practices & Technical Debt Roadmap

This document serves as an intentional log of architectural simplifications made during the initial learning phases of this project. To avoid premature complexity, foundational concepts were implemented by hand with minimal abstractions. 

Items listed here represent **production-grade best practices** that have been deferred. Any transition from a simplified approach to a production pattern must first be suggested, reviewed, and explicitly approved before implementation.

---

## Tracking Table

| ID | Domain | Current Simplified Approach | Production Best Practice | Status |
|:---|:---|:---|:---|:---|
| **P-01** | Data Layer | Local JSON files (`data/*.json`) | PostgreSQL / MySQL with Prisma ORM & ACID transactions | Deferred |
| **P-02** | Vector Storage | In-memory `Array.map` & manual cosine similarity | `pgvector` (PostgreSQL) or dedicated Vector DB (Qdrant / Chroma) with HNSW indexing | Deferred |
| **P-03** | RAG Chunking | Static splitting by `## ` heading | Recursive character splitting with sliding window overlap & parent metadata injection | Deferred |
| **P-04** | Chat Memory | Stateless turns (single `[system, user]` per reply) | Session store in Redis/DB with Sliding Window & Conversation Summarization | Roadmap Step 3 |
| **P-05** | Realtime UX | Full batch reply after all tool rounds finish | Token-by-token streaming over Socket.IO / SSE with typing indicator | Roadmap Step 6 |
| **P-06** | Auth & Security | Static mock tokens in memory (`token-alice`) | JWT with access/refresh lifecycle, rate limiting, and prompt injection guardrails | Deferred |
| **P-07** | Observability | Terminal `console.log` | Tracing with Langfuse / OpenTelemetry & RAG evaluation (RAGAS / Faithfulness metrics) | Deferred |
| **P-08** | Async Ingestion | Synchronous CLI script (`scripts/build-index.js`) | Message Queue (BullMQ / RabbitMQ) worker pipeline with user-namespaced vector loading | Deferred |

---

## Detailed Improvement Profiles

### P-01: Database & Persistence Layer
* **Current State:** Static JSON files (`users.json`, `orders.json`, `products.json`, `shipments.json`) read via Node.js `fs`.
* **Trade-off:** Fast and zero-setup for learning, but lacks concurrent write protection, transactions, indexing, and scalability.
* **Production Recommendation:** 
  - Migrate to PostgreSQL using an ORM like Drizzle or Prisma.
  - Implement row-level locking for inventory management.
  - Foreign key constraints between orders, products, and users.
* **Prerequisites for Implementation:** Dockerized database setup, migration scripts.

---

### P-02: Vector Storage & Semantic Search (Vector DB)
* **Current State:** Policy embeddings stored in `data/embeddings.json`. Search runs a linear `for` loop computing cosine similarity against all chunks in memory.
* **Trade-off:** Excellent for teaching mathematical foundations of vector embeddings, but scales $O(N)$ and cannot handle hundreds of thousands of document chunks.
* **Production Recommendation:**
  - Utilize `pgvector` (PostgreSQL extension) or Qdrant.
  - Leverage HNSW (Hierarchical Navigable Small World) indexing for sub-millisecond approximate nearest neighbor (ANN) retrieval.
  - Enable hybrid search (combining BM25 keyword search with dense vector similarity).
* **Prerequisites for Implementation:** Vector DB container or hosted instance, embedding migration pipeline.

---

### P-03: RAG Ingestion & Chunking Pipeline
* **Current State:** Markdown files split purely by top-level `## ` headings. Chunks assume homogeneous size.
* **Trade-off:** Clean and readable for short policies, but fails on very long sections or nested content.
* **Production Recommendation:**
  - Implement recursive text chunking (e.g. 500-token chunks with 50-token overlap).
  - Contextual header preservation (injecting document title and parent headings into every chunk).
  - Automated re-indexing pipeline triggered whenever policy documents change.
* **Prerequisites for Implementation:** Chunking utility with token/character boundary detection.

---

### P-04: Conversation History & Context Window Management
* **Current State:** Every message is processed independently without remembering previous turns.
* **Trade-off:** Simple and stateless, but prevents multi-turn follow-ups (e.g., "how much was it?").
* **Production Recommendation:**
  - Track conversation sessions by connection or user ID.
  - Maintain a sliding window of recent turns (e.g., last 6–10 messages).
  - Compress or summarize older turns when approaching context limits.
* **Prerequisites for Implementation:** In-memory or Redis-backed message store, session identifiers.

---

### P-05: Realtime Streaming UX
* **Current State:** Client waits 3–8 seconds while tool calls and LLM generation finish, receiving the entire response at once (`stream: false`).
* **Trade-off:** Very easy to debug tool calling loops, but feels slow to end users.
* **Production Recommendation:**
  - Enable `stream: true` on the LLM client.
  - Emit incremental token events (`socket.emit('chunk', { delta })`) as tokens arrive.
  - Display realtime typing indicators while tool executions run in the background.
* **Prerequisites for Implementation:** Async generator stream parser on Socket.IO transport.

---

### P-06: Security, Guardrails & Token Auth
* **Current State:** Static token lookup (`users.find(u => u.token === token)`) and basic system prompt rules against hallucination.
* **Trade-off:** Sufficient for local prototyping, insecure for public web deployment.
* **Production Recommendation:**
  - Industry-standard JWT verification with expiration and refresh tokens.
  - Rate limiting per IP/user to prevent LLM denial-of-service or billing exhaustion.
  - LLM guardrails (input validation and output sanitization to block prompt injection attacks).
* **Prerequisites for Implementation:** Auth provider / crypto signing keys, Redis rate-limiting middleware.

---

### P-07: LLM Observability & Evaluation
* **Current State:** Manual `console.log` statements for tool rounds and retrieval scores.
* **Trade-off:** Direct and visible in terminal, but lacks analytics, latency monitoring, or systematic quality scoring.
* **Production Recommendation:**
  - Integrate an observability framework (e.g. Langfuse, LangSmith, or OpenTelemetry).
  - Track token consumption, latency per tool round, and user satisfaction signals.
  - Implement automated RAG evaluation (measuring Context Relevance, Faithfulness, and Answer Relevance).
* **Prerequisites for Implementation:** Observability SDK and telemetry endpoints.

---

### P-08: Asynchronous Document Ingestion via Message Queue (Producer-Consumer)
* **Current State:** Synchronous, manual CLI command (`npm run index`) that reads static markdown files on disk and embeds them sequentially.
* **Trade-off:** Minimal and transparent for local development, but cannot support dynamic runtime uploads, multi-user documents, or background processing without blocking.
* **Production Recommendation:**
  1. **Upload API (Producer):** User or admin uploads documents (PDF, DOCX, MD) via HTTP endpoint (`POST /api/documents/upload`).
  2. **Message Queue (Decoupling):** API acknowledges upload immediately (`202 Accepted`) and pushes an ingestion job into a Message Queue (e.g. BullMQ / Redis, RabbitMQ, or AWS SQS) with metadata: `{ userId, documentId, filePath, status: "queued" }`.
  3. **Background Worker (Consumer):** Separate worker processes dequeue the job asynchronously, parse/clean the document, chunk text with sliding overlap, and call embedding models in batches.
  4. **Multi-Tenant / Per-User Vector Partitioning:** Embeddings are loaded into the Vector DB tagged with `userId` / `tenantId` metadata (or dedicated vector namespaces) so users can only search their own documents.
  5. **Notification / Status Event:** Worker updates document status in DB (`"ready"`) and notifies client via WebSockets or webhook.
* **Prerequisites for Implementation:** Redis or RabbitMQ service, BullMQ worker process, multipart file upload middleware (e.g. Multer), per-user metadata filtering in vector queries.


