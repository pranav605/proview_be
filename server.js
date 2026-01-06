import express, { response } from 'express'
import cors from 'cors'
import bodyParser from 'body-parser'
import fetch from 'node-fetch'
import dotenv from 'dotenv'
import { GoogleGenAI } from '@google/genai'
import supabase from './utils/supabaseClient.js'

dotenv.config()
const app = express()
app.use(cors())
app.use(bodyParser.json())
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const SERP_API_KEY = process.env.SERP_API_KEY

async function getGeminiResponse({ model, contents, maxRetries = 5 }) {
  let attempt = 0;
  let delay = 500; // start with 0.5 seconds

  while (attempt < maxRetries) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
      });
      return res; // Success
    } catch (err) {
      attempt++;

      // Only retry on transient errors
      const status = err?.status || err?.response?.status;

      const shouldRetry =
        status === 503 || // model unavailable
        status === 500 || // internal error
        status === 429 || // rate limited
        !status;          // network errors (no response)

      if (!shouldRetry || attempt >= maxRetries) {
        console.error("Final error:", err);
        throw err;
      }

      console.warn(
        `Attempt ${attempt} failed (status ${status}). Retrying in ${delay}ms...`
      );

      // wait before retry
      await new Promise(r => setTimeout(r, delay));

      // exponential backoff
      delay *= 2;
    }
  }
}

async function generateSearchPrompts(productName) {
  //   const prompt = `
  // You are an intelligent AI assistant. Generate 3 concise Google search queries
  // that would help find product reviews for "${productName}" across multiple sources.
  // Focus on Reddit, Amazon.
  // Output each query on a new line.
  // `
  const prompt = `
You are an intelligent AI assistant. Generate 3 concise Google search queries
that would help find product reviews for "${productName}" across multiple sources.
Focus on Reddit, Amazon, Youtube.
Suggest only popular sources for reviews.
Do not generate any other text except the search queries.
The output format should be: 'search query 1
search query 2
search query 3'
Output each query on a new line.
`
  // const res = await fetch(OLLAMA_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     model: 'qwen2.5:3b',
  //     prompt,
  //     stream: false,
  //   }),
  // })

  const res = await getGeminiResponse({
    model: "gemini-2.5-flash",
    contents: prompt
  })
  console.log(res);

  // const data = await res.json()
  const text = res.text || '' // ✅ fallback to empty string

  return text
    .split('\n')
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(-3)
}

//Find the product from search query
async function findProduct(query) {
  const productPrompt = `
You are a product name extractor.

Your task: Identify the exact product name(s) mentioned in the user's query, even if the phrasing is indirect or conversational.

Guidelines:
- Focus on brand + model combinations (e.g., "Tesla Model S", "iPhone 17", "Samsung Galaxy S24").
- Output only the product name(s), exactly as they appear in the query (preserve capitalization).
- If multiple products are mentioned, list them separated by commas.
- If no clear product name is present, output "None".
- Do NOT include any explanations, reasoning, or extra text.

Search Query:
"${query}"

Output:
`

  // const res = await fetch(OLLAMA_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     model: 'llama3:instruct',
  //     prompt: productPrompt,
  //     stream: false,
  //   }),
  // })

  const res = await getGeminiResponse({
    model: "gemini-2.5-flash",
    contents: productPrompt
  })

  // const data = await res.json()
  let response = res.text?.trim() || ''

  // ✅ Clean up unwanted prefix/suffix or markdown quotes
  response = response
    .replace(/^["'\s]+|["'\s]+$/g, '')
    .replace(/^(None\.?|No product.*)$/i, 'None')

  return response
}


// 🧩 3️⃣ Summarize reviews using Ollama
// async function summarizeReviews(productName, reviews) {
//   const context = reviews
//     .map((r, i) => `(${i + 1}) ${r.title} - ${r.snippet} [${r.link}]`)
//     .join('\n')

//   const summaryPrompt = `
// You are a product review summarizer.
// Summarize the following reviews about "${productName}" in a concise way.
// Highlight common pros and cons in two seperate paragraphs and in the third paragraph suggest if the user should buy, consider or ignore the product based on the reviews, and cite the sources (by their numbers).

// Reviews:
// ${context}

// Output format example:
// "Most reviewers praise the iPhone 15's camera and battery life (1, 3), but note its high price (2, 4)."
// `

//   const res = await fetch(OLLAMA_URL, {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       model: 'llama3:instruct',
//       prompt: summaryPrompt,
//       stream: false,
//     }),
//   })

//   const data = await res.json()
//   return data.response
// }

async function summarizeReviews(productName, reviews) {
  const context = reviews
    .map((r, i) => `(${i + 1}) ${r.title} - ${r.snippet} [${r.link}]`)
    .join('\n')

  const summaryPrompt = `
You are an intelligent product review summarizer. Your goal is to create a clear, natural, and professional summary of the reviews provided.

Instructions:
1. Summarize the reviews of "${productName}" in **three consecutive paragraphs**:
   - The first paragraph should naturally highlight the **common positive aspects** mentioned in the reviews.
   - The second paragraph should naturally highlight the **common negative aspects**.
   - The third paragraph should provide a **recommendation** on whether the user should buy, consider, or ignore the product.
2. Write in **full sentences** with smooth transitions. Do **not** use headings, bullet points, or lists. The text should flow like a human-written article.
3. Cite review sources by their numbers in parentheses corresponding to the numbered list below (e.g., (1, 3, 5)).
4. Keep it concise, informative, and professional. Include only relevant information from the reviews.

Reviews:
${context}

Output example:
"Most reviewers praise the iPhone 15's camera and battery life (1, 3), but note its high price (2, 4). Based on these reviews, potential buyers should consider the iPhone 15 if photography and battery performance are important, but be aware of the cost (1, 2, 3, 4)."
`

  // const res = await fetch(OLLAMA_URL, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     model: 'llama3:instruct',
  //     prompt: summaryPrompt,
  //     stream: false,
  //   }),
  // })
  const res = await getGeminiResponse({
    model: 'gemini-2.5-flash',
    contents: summaryPrompt
  })

  // const data = await res.json()
  return res.text
}


async function fetchSearchResults(query) {
  const params = new URLSearchParams({
    q: query,
    api_key: SERP_API_KEY,
    num: 5, // number of results to fetch
  })

  const res = await fetch(`https://serpapi.com/search.json?${params}`)
  const data = await res.json()

  // Extract relevant snippets (from organic results)
  if (!data.organic_results) return []

  return data.organic_results.map((r) => ({
    title: r.title,
    link: r.link,
    snippet: r.snippet,
  }))
}

// 🧩 4️⃣ Main API route
app.post('/api/ask', async (req, res) => {
  const { prompt, chatId, userId } = req.body

  try {
    // Detect product-like input
    // const isProductQuery = /\b(buy|review|iphone|laptop|camera|tv|headphones|watch|phone|macbook)\b/i.test(
    //   prompt
    // )
    const isProductQuery = true;

    if (isProductQuery) {

      const filteredProduct = await findProduct(prompt);
      console.log(`🔍 Detected product query: "${filteredProduct}"`)
      if (filteredProduct == "None") {
        throw "Product name not found";
      }
      const searchPrompts = await generateSearchPrompts(filteredProduct)
      if (searchPrompts.length == 0) {
        throw "Search results not found"
      }

      console.log('🧭 Generated search prompts:', searchPrompts)
      // Fetch search results for all prompts
      const allResults = []
      for (const q of searchPrompts) {
        const results = await fetchSearchResults(q)
        allResults.push(...results)
      }
      console.log(allResults);
      // Summarize reviews
      const summary = await summarizeReviews(filteredProduct, allResults)
      if (summary) {

        const { data, error } = await supabase.from('products')
          .upsert({
            name: filteredProduct, summary: summary,
          },
            {
              onConflict: 'name',
            })
          .select('id, summary')
        const productData = data;
        console.log("Product data:", productData);

        if (error) {
          throw error
        } else {
          const { data, error } = await supabase.from('chats')
            .update({ product_id: productData[0].id, summary: summary, status: "ready" }).eq('id', chatId).select('');



          if (error) {
            throw error;
          } else {
            allResults.forEach((x) => {
              const updateSources = async () => {
                const { data, error } = await supabase.from('product_sources')
                  .upsert({ product_id: productData[0].id, source_name: x.title, source_url: x.link, source_snippet: x.snippet })
              }

              const updateChatSources = async () => {
                const { data, error } = await supabase.from('chat_sources')
                  .insert({ chat_id: chatId, source_name: x.title, source_url: x.link, source_snippet: x.snippet })
              }

              updateSources();
              updateChatSources();
            })
          }
        }
      }
      return res.json({ response: summary, searchData: allResults })

    }
    // Default behavior (normal Ollama Q&A)
    const ollamaRes = await fetch(OLLAMA_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3:instruct',
        prompt,
        stream: false,
      }),
    })
    const data = await ollamaRes.json()
    res.json({ response: data.response })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Failed to connect to Ollama or SerpAPI.' })
  }
})

app.listen(5000, '0.0.0.0', () =>
  console.log('✅ Server running on http://localhost:5000')
)
