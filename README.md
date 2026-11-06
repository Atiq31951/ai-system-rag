# AI Customer Support Chat (E-commerce)

একটি আধুনিক এবং পরিচ্ছন্ন AI-assisted কাস্টমার সাপোর্ট চ্যাট সিস্টেম। এটি একটি একক ই-কমার্স কোম্পানির জন্য Node.js 24, Express 5, এবং Socket.IO-এর ওপর ভিত্তি করে Clean Architecture নীতিতে তৈরি হচ্ছে।

---

## ১. প্রজেক্টের উদ্দেশ্য ও নীতিমালা (Project Goal & Constraints)

- **উদ্দেশ্য:** ই-কমার্স কাস্টমার সাপোর্টের জন্য AI চ্যাটবট তৈরির আর্কিটেকচার শেখা।
- **লার্নিং রোডম্যাপ:** Socket.IO চ্যাট $\rightarrow$ Tool/Function Calling $\rightarrow$ RAG $\rightarrow$ LangChain।
- **Plain JavaScript (ESM):** কোনো বিল্ড টুল বা TypeScript ছাড়া সরাসরি Node.js 24 নেটিভ ফিচার (ESM, `--env-file`, `crypto.randomUUID`) ব্যবহার।
- **Realtime Transport:** `socket.io` লাইব্রেরি (কোনো অতিরিক্ত rooms, namespaces বা জটিলতা ছাড়া)।
- **No Database:** ডেটা সংরক্ষণের জন্য কোনো বাহ্যিক ডাটাবেজ ছাড়া `data/` ফোল্ডারের লোকাল JSON ফাইল ব্যবহার।
- **Minimal Noise:** অপ্রয়োজনীয় থার্ড-পার্টি লাইব্রেরি বা অতিরিক্ত অ্যাবস্ট্রাকশন পরিহার করা।

---

## ২. আর্কিটেকচার ও বাউন্ডারি (Architecture Boundaries)

- **`src/server.js`:** HTTP সার্ভার তৈরি করে এবং একই সাথে Express ও Socket.IO সার্ভারকে যুক্ত করে।
- **`src/modules/chat/chat.socket.js`:** সকেট ইভেন্ট হ্যান্ডলার। Handshake auth মিডলওয়্যার (`io.use`), Zod ভ্যালিডেশন, `socket.data`-তে পার-কানেকশন স্টেট (user, busy) বজায় রাখা, এবং ক্লায়েন্টে ইভেন্ট এমিট করার কাজ করে। Socket.IO সম্পর্কিত কোড শুধুমাত্র এখানেই থাকে।
- **`src/modules/chat/chat.service.js`:** ডোমেন সার্ভিস (`async function*` জেনারেটর)। এটি Socket.IO, HTTP বা Express সম্পর্কে কিছুই জানে না; শুধুমাত্র বিশুদ্ধ ইভেন্ট অবজেক্ট `{ type, ...data }` ইল্ড (yield) করে।
- **`src/infrastructure/`:** এক্সটার্নাল অ্যাডাপ্টারস (যেমন: `ollama.client.js`, `data-store.js`)। এতে কোনো বিজনেস রুলস থাকে না।
- **Express App:** শুধুমাত্র সাধারণ HTTP রুট (যেমন: `GET /home`) নিয়ন্ত্রণ করে।

---

## ৩. ইভেন্ট কন্ট্রাক্ট (Event Contract)

### ক. Authentication (Handshake - কোনো ইভেন্ট নয়)
ক্লায়েন্ট কানেক্ট করার সময় টোকেন পাস করে: `io(url, { auth: { token } })`
- **টোকেন না থাকলে:** Guest হিসেবে কানেকশন গৃহীত হবে (`socket.data.user = null`)।
- **ভ্যালিড টোকেন হলে:** ইউজার ডাটা সেভ হবে (`socket.data.user = { id, name, email }`), টোকেন কখনো স্টেটে রাখা হবে না।
- **ইনভ্যালিড টোকেন হলে:** কানেকশন রিজেক্ট করা হবে (`next(new Error('Invalid token'))`); ক্লায়েন্ট পাবে `connect_error`।

### খ. Client $\rightarrow$ Server
| Event | Payload | অর্থ |
| :--- | :--- | :--- |
| `chat` | `{ content }` | ইউজারের পাঠানো চ্যাট মেসেজ |

### গ. Server $\rightarrow$ Client
| Event | Payload | কখন পাঠানো হয় |
| :--- | :--- | :--- |
| `ready` | `{ user: { id, name } \| null }` | কানেকশন সফল হওয়ার সাথে সাথে |
| `token` | `{ text }` | রিপ্লাইয়ের প্রতিটি শব্দের খণ্ড/টোকেন |
| `tool` | `{ name, status }` | টুল/ফাংশন এক্সিকিউট চলাকালীন |
| `done` | `{}` | পুরো রিপ্লাই সম্পন্ন হলে |
| `error` | `{ message }` | ইনভ্যালিড পেলোড, busy বা কোনো ফেইলিওর ঘটলে |

---

## ৪. রোডম্যাপ (Roadmap Status)

1. [x] **Socket.IO chat skeleton (fake word-by-word reply, no LLM)**
2. [x] **Dummy data (users, products, orders) + fake auth via handshake token**
3. [ ] **Ollama streaming + system prompt + guest/login logic**
4. [ ] **Tool calling (inside the stream)**
5. [ ] **RAG (policy docs: return, refund, shipping)**
6. [ ] **Minimal HTML client (socket.io-client in the browser)**
7. [ ] **LangChain**

---

## ৫. ফাইল ও ফোল্ডার স্ট্রাকচার

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
│   ├── users.json          # ডামি ইউজার ডেটা
│   ├── products.json       # ডামি প্রোডাক্ট ডেটা
│   └── orders.json         # ডামি অর্ডার ডেটা
├── scripts/
│   └── test-client.js      # CLI ভিত্তিক Socket.IO টেস্ট ক্লায়েন্ট
└── src/
    ├── app.js              # Express app কনফিগারেশন
    ├── server.js           # HTTP + Socket.IO সার্ভার
    ├── config/
    │   └── index.js        # Zod env ভ্যালিডেশন
    ├── infrastructure/
    │   ├── data-store.js   # JSON ডাটা রিড হেল্পার
    │   ├── errors.js       # কাস্টম AppError ক্লাসেস
    │   ├── logger.js       # Pino লগার ইনস্ট্যান্স (commented boilerplate)
    │   └── ollama.client.js # মাল্টি-মডেল Ollama ক্লায়েন্ট
    ├── middleware/
    │   ├── error-handler.js # সেন্ট্রাল এরর হ্যান্ডলার
    │   └── http-logger.js   # HTTP লগার মিডলওয়্যার
    └── modules/
        └── chat/
            ├── chat.service.js # ডোমেইন চ্যাট সার্ভিস (async generator)
            └── chat.socket.js  # Socket.IO হ্যান্ডলার ও auth মিডলওয়্যার
```

---

## ৬. সার্ভার রান ও টেস্টিং নির্দেশিকা

### সার্ভার স্টার্ট করুন:
```bash
npm run dev
```

### টেস্ট ক্লায়েন্ট চালানো (`scripts/test-client.js`):

১. **Guest User চ্যাট:**
```bash
node scripts/test-client.js "Hello support"
```

২. **Logged-in User (Alice) চ্যাট:**
```bash
node scripts/test-client.js token-alice "Track my order"
```

৩. **Invalid Token টেস্ট (Handshake failure):**
```bash
node scripts/test-client.js wrong-token "Hello"
```
