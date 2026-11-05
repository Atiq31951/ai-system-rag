# Multi-Tenant AI Customer Support Chat (E-commerce)

একটি আধুনিক, মিনিমালিস্ট এবং স্কেলেবল AI-assisted কাস্টমার সাপোর্ট চ্যাট সিস্টেম। এটি ই-কমার্স অ্যাপ্লিকেশনের জন্য Node.js 24 এবং Express 5-এর ওপর ভিত্তি করে Clean Architecture প্যাটার্নে তৈরি করা হচ্ছে।

---

## ১. প্রজেক্টের উদ্দেশ্য ও নীতিমালা (Design Principles)

- **উদ্দেশ্য:** ই-কমার্স কাস্টমার সাপোর্টের জন্য AI চ্যাটবট তৈরি করা যা ক্রমান্বয়ে **Function Calling**, **RAG (Retrieval-Augmented Generation)**, এবং পরবর্তীতে **LangChain** ইন্টিগ্রেশন সমর্থন করবে।
- **Minimal Noise:** অপ্রয়োজনীয় থার্ড-পার্টি প্যাকেজ এড়িয়ে চলা।
- **Plain JavaScript (ESM):** কোনো ভারী বিল্ড টুল বা ট্রান্সপাইলার ছাড়া সরাসরি Node.js 24-এর নেটিভ ECMAScript Modules (ESM)।
- **No Database:** ডেটা সংরক্ষণের জন্য কোনো বাহ্যিক ডেটাবেজের বদলে হালকা JSON ফাইল ব্যবহার।
- **Local AI Engine:** বাহ্যিক প্রোভাইডারের ওপর নির্ভরশীল না হয়ে লোকাল Ollama দিয়ে রান করানো।

---

## ২. আর্কিটেকচার ও রিকোয়েস্ট ফ্লো (Architecture Flow)

সিস্টেমটি Clean / Layered Architecture অনুসরণ করে তৈরি:

```text
[Frontend / Client]
       │
       ▼ (HTTP POST /chat)
[Route Layer]              (src/app.js বা routes)
       │
       ▼
[Controller Layer]         (Request validation, SSE Stream handling)
       │
       ▼
[Service Layer]            (Business Rules, Prompt Engineering, RAG & Tool Orchestration)
       │
       ▼
[Infrastructure Layer]     (src/infrastructure/ollama.client.js - Low-level HTTP Adapter)
       │
       ▼
[Ollama Engine]            (Local LLM Server - Port 11434)
```

> **নোট:** `ollama.client.js`-কে `infrastructure/` ফোল্ডারে রাখা হয়েছে কারণ এটি কোনো বিজনেস রুলস জানে না, এটি কেবল একটি External HTTP Adapter। চ্যাট ও সাপোর্টের মূল বিজনেস লজিক থাকবে `service` লেয়ারে।

---

## ৩. এখন পর্যন্ত যা যা সম্পন্ন হয়েছে (Completed Work)

### ক. প্রজেক্ট ক্লিনআপ ও ডিপেনডেন্সি মিনিমাইজেশন
- অপ্রয়োজনীয় ফাইলসমূহ (`test/`, `.env.test`, `eslint.config.js`, `request-id.js`, `health/` module) রিমুভ করা হয়েছে।
- আনইউজড প্যাকেজগুলো (`eslint`, `supertest`, `prettier` ইত্যাদি) বাদ দেওয়া হয়েছে।
- রানটাইম প্যাকেজ হিসেবে শুধু `express`, `zod`, `pino`, `pino-http` এবং dev প্যাকেজ হিসেবে `nodemon`, `pino-pretty` রাখা হয়েছে।

### খ. ডেভেলপমেন্ট ও স্ক্রিপ্টস
- `nodemon` কনফিগার করা হয়েছে যাতে কোড পরিবর্তনের সাথে সাথে সার্ভার রিস্টার্ট নেয়।
- `package.json`-এ শুধুমাত্র দুটি প্রয়োজনীয় স্ক্রিপ্ট রাখা হয়েছে:
  - `npm run dev`: `nodemon --env-file=.env src/server.js`
  - `npm start`: `node --env-file=.env src/server.js`

### গ. এরর হ্যান্ডলিং ও কোর মিডলওয়্যার
- **[src/infrastructure/errors.js](src/infrastructure/errors.js):** `AppError`, `BadRequestError`, `NotFoundError`, এবং `UnauthorizedError` রাখা হয়েছে।
- **[src/middleware/error-handler.js](src/middleware/error-handler.js):** সেন্ট্রাল JSON এরর হ্যান্ডলার যা সব এররকে একটি প্রেডিক্টেবল ফরম্যাটে রিটার্ন করে। রেসপন্স থেকে অপ্রয়োজনীয় `requestId` বাদ দেওয়া হয়েছে এবং 500 এররের জন্য `console.error(err)` যুক্ত করা হয়েছে।
- **[src/app.js](src/app.js):** টেস্ট রুট হিসেবে `GET /home` যোগ করা হয়েছে যা `{"message": "Hello World"}` রিটার্ন করে, এবং একটি 404 নট-ফাউন্ড হ্যান্ডলার রাখা হয়েছে।

### ঘ. স্ট্যান্ডার্ড প্র্যাকটিস Logger (Commented Out)
- **[src/infrastructure/logger.js](src/infrastructure/logger.js)** এবং **[src/middleware/http-logger.js](src/middleware/http-logger.js)**-এ Pino-এর স্ট্যান্ডার্ড বয়লারপ্লেট রাখা হয়েছে।
- কোডের বিভিন্ন জায়গায় (`server.js`, `app.js`, `error-handler.js`) লগার সম্পর্কিত কলগুলো `commented out` রাখা হয়েছে, যাতে বর্তমানে কোনো অপ্রয়োজনীয় লগ আউটপুট না আসে, কিন্তু ভবিষ্যতে প্রয়োজন হলে সহজেই আন-কমেন্ট করে ব্যবহার করা যায়।

### ঙ. Ollama ও Multi-Model ক্লায়েন্ট
- **[src/infrastructure/ollama.client.js](src/infrastructure/ollama.client.js):** Node 24 native `fetch` ব্যবহার করে একটি প্রোডাকশন-রেডি Ollama ক্লায়েন্ট তৈরি করা হয়েছে।
  - **Dynamic Model Support:** ডিফল্ট মডেল `.env` থেকে নেয়, তবে রানটাইমে যেকোনো ভিন্ন মডেল (যেমন: `qwen3:8b`, `deepseek-r1:7b`) পাস করা যায়।
  - **Chat (`chat`):** কনভারসেশন হিস্ট্রি, Function Calling (`tools`), এবং Streaming (`stream: true`) সমর্থন করে।
  - **Embeddings (`embed`):** পরবর্তী RAG ফিচারের জন্য ভেক্টর এমবেডিং তৈরির মেথড যোগ করা হয়েছে।
  - **Resilient Error Handling:** Ollama সার্ভার অফলাইন থাকলে বা কোনো এরর দিলে স্বয়ংক্রিয়ভাবে `503 OLLAMA_UNAVAILABLE` বা সংশ্লিষ্ট `AppError` হ্যান্ডেল করে।

---

## ৪. প্রজেক্ট ফাইল স্ট্রাকচার (File Tree)

```text
ai-system-rag/
├── README.md               # সম্পূর্ণ প্রজেক্ট ডকুমেন্টেশন
├── .env                    # এনভায়রনমেন্ট কনফিগারেশন ফাইল
├── .env.example            # এনভায়রনমেন্ট কনফিগারেশন টেমপ্লেট
├── .gitignore
├── .nvmrc
├── .prettierrc
├── package.json            # ডিপেনডেন্সি ও স্ক্রিপ্টস
├── package-lock.json
├── data/
│   └── hr-policy.txt       # RAG-এর জন্য ডক ফাইল
└── src/
    ├── app.js              # Express app ইন্সট্যান্স, মিডলওয়্যার ও রুটস
    ├── server.js           # HTTP listener ও Graceful Shutdown হ্যান্ডলার
    ├── config/
    │   └── index.js        # Zod দিয়ে ভ্যালিডেট করা ফ্রোজেন কনফিগারেশন
    ├── infrastructure/
    │   ├── errors.js       # কাস্টম AppError ও সাব-ক্লাসেস
    │   ├── logger.js       # Pino structured logger ইন্সট্যান্স
    │   └── ollama.client.js # মাল্টি-মডেল Ollama HTTP ক্লায়েন্ট
    └── middleware/
        ├── error-handler.js # সেন্ট্রাল গ্লোবাল এরর হ্যান্ডলিং মিডলওয়্যার
        └── http-logger.js   # Express HTTP রিকোয়েস্ট লগার
```

---

## ৫. কনফিগারেশন ও এনভায়রনমেন্ট ভ্যারিয়েবল

`.env` ফাইলে নিচের কনফিগারেশনগুলো সেট করা রয়েছে:

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=qwen3:8b
```

---

## ৬. সার্ভার রান করার নিয়ম

১. প্রজেক্ট ডিরেক্টরিতে যান:
```bash
cd ai-system-rag
```

২. ডেভেলপমেন্ট মোডে রান করুন (Nodemon সহ):
```bash
npm run dev
```

৩. টেস্ট রুট চেক করুন:
```bash
curl http://localhost:3000/home
# আউটপুট: {"message":"Hello World"}
```

---

## ৭. পরবর্তী রোডম্যাপ (Next Steps)

- [ ] **Phase 1: Chat Route & Service:** 
  - `POST /chat` এন্ডপয়েন্ট তৈরি করা (Streaming / SSE রেসপন্স সহ)।
  - `chat.service.js` তৈরি করা যা ইউজার প্রম্পট ও সিস্টেম রুলস ম্যানেজ করবে।
- [ ] **Phase 2: Function Calling (Tool Calling):**
  - ই-কমার্স ডোমেইনের জন্য টুলস তৈরি করা (যেমন: `getOrderDetails(orderId)`, `cancelOrder(orderId)` ইত্যাদি)।
  - Ollama-র `tools` প্যারামিটারের মাধ্যমে মডেল যাতে স্বয়ংক্রিয়ভাবে ফাংশন কল করতে পারে তা ইমপ্লিমেন্ট করা।
- [ ] **Phase 3: RAG (Retrieval-Augmented Generation):**
  - `data/` ফোল্ডারের ফাইলগুলো চাঙ্ক (chunk) করে ভেক্টর এমবেডিং তৈরি করা।
  - কাস্টমার প্রশ্নের প্রাসঙ্গিক তথ্য খুঁজে এনে প্রম্পটের সাথে যুক্ত করা।
- [ ] **Phase 4: LangChain Integration:**
  - পরবর্তীতে প্রয়োজন অনুযায়ী ফ্রেমওয়ার্ক ইন্টিগ্রেশন।

