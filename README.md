# 🧠 AI Product Review Summarization Backend

This backend service powers an AI-driven product review assistant. Given a user prompt, it automatically:

- Detects the product being discussed  
- Generates targeted search queries  
- Fetches real-world review snippets from popular platforms  
- Summarizes pros, cons, and buying recommendations using Google Gemini  
- Stores products, summaries, chats, and sources in Supabase  

The service is built with **Node.js**, **Express**, **Google Gemini**, **SerpAPI**, and **Supabase**.

---

## 🚀 Features

- **Product Detection**  
  Uses Gemini to extract exact product names from natural language queries.

- **Automated Review Discovery**  
  Generates intelligent Google search queries focused on Reddit, Amazon, and YouTube.

- **Live Review Fetching**  
  Fetches real review snippets using SerpAPI.

- **AI Review Summarization**  
  Produces a human-like, three-paragraph summary:
  - Common positives  
  - Common negatives  
  - Buy / Consider / Ignore recommendation  
  All with cited sources.

- **Retry & Backoff Handling**  
  Robust retry logic with exponential backoff for transient Gemini API failures.

- **Supabase Integration**
  - Product storage with conflict handling  
  - Chat status updates  
  - Review source persistence  

---

## 🛠️ Tech Stack

| Layer        | Technology |
|--------------|------------|
| Server       | Node.js, Express |
| AI Model     | Google Gemini (`gemini-2.5-flash`) |
| Search       | SerpAPI |
| Database     | Supabase (PostgreSQL) |
| HTTP Client  | node-fetch |
| Config       | dotenv |
| Middleware   | cors, body-parser |

---

## 📁 Project Structure

```
├── utils/
│   └── supabaseClient.js
├── .env
├── index.js
└── README.md
```

---

## 🔐 Environment Variables

Create a `.env` file in the root directory:

```env
GEMINI_API_KEY=your_google_gemini_api_key
SERP_API_KEY=your_serpapi_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_anon_key
```

---

## 📦 Installation

```bash
git clone https://github.com/pranav605/proview_be.git
cd proview_be
npm install
```

---

## ▶️ Running the Server

```bash
npm start
```

The server will run on:

```
http://localhost:5000
```

---

## 📡 API Endpoint

### `POST /api/ask`

#### Request Body

```json
{
  "prompt": "Should I buy the Sony WH-1000XM5 headphones?",
  "chatId": "uuid-of-chat",
  "userId": "uuid-of-user"
}
```

#### Response

```json
{
  "response": "Most reviewers praise the Sony WH-1000XM5 for its excellent noise cancellation...",
  "searchData": [
    {
      "title": "Sony WH-1000XM5 Review",
      "link": "https://example.com",
      "snippet": "These headphones deliver..."
    }
  ]
}
```

---

## 🧩 Database Tables Used

- **products**
  - `id`
  - `name` (unique)
  - `summary`

- **chats**
  - `id`
  - `product_id`
  - `summary`
  - `status`

- **product_sources**
  - `product_id`
  - `source_name`
  - `source_url`
  - `source_snippet`

- **chat_sources**
  - `chat_id`
  - `source_name`
  - `source_url`
  - `source_snippet`

---

## 🔁 AI Retry Logic

The Gemini API calls use:
- Up to **5 retries**
- **Exponential backoff**
- Retries on:
  - `429` (rate limits)
  - `500`, `503`
  - Network failures

This ensures reliability under load or temporary outages.

---

## ⚠️ Error Handling

- Graceful handling when:
  - Product name cannot be detected
  - No search results are found
  - External APIs fail
- Returns `500` with a generic error message to avoid leaking internals.

---

## 🧠 Future Improvements

- Parallel search result fetching  
- Review deduplication  
- Streaming summaries  
- User-level caching  
- Product confidence scoring  

---

## 📜 License

MIT License
