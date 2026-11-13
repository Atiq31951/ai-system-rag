import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../../config/index.js';
import { ollamaClient } from '../../infrastructure/ollama.client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EMBEDDINGS_FILE = path.resolve(__dirname, '../../../data/embeddings.json');

/**
 * Minimum similarity score threshold for policy retrieval.
 * Results with cosine similarity below this value are considered irrelevant.
 */
export const MIN_SCORE = 0.5;

/**
 * In-memory cache for policy embeddings.
 * @type {Array<{ id: string, source: string, heading: string, text: string, embedding: Array<number> }> | null}
 */
let cachedIndex = null;

/**
 * Calculates cosine similarity between two numeric vectors.
 * Formula: dotProduct(a, b) / (magnitude(a) * magnitude(b))
 *
 * @param {Array<number>} a - First vector
 * @param {Array<number>} b - Second vector
 * @returns {number} Value between -1.0 and 1.0 (typically 0.0 to 1.0 for normalized text embeddings)
 */
export function cosineSimilarity(a, b) {
  // 1. If either vector is missing or their lengths do not match, cannot calculate
  if (!a || !b || a.length !== b.length) {
    return 0;
  }

  // 2. Initialize accumulators for dot product and magnitudes
  let dotProduct = 0; // Sum of a[i] * b[i]
  let magnitudeA = 0; // Sum of squares for vector a (a[i] * a[i])
  let magnitudeB = 0; // Sum of squares for vector b (b[i] * b[i])

  // 3. Loop through all vector dimensions to accumulate dot product and squared magnitudes
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  // 4. Calculate actual Euclidean vector lengths (square root of sum of squares)
  const normA = Math.sqrt(magnitudeA);
  const normB = Math.sqrt(magnitudeB);

  // 5. Prevent division by zero if either vector is all zeros (empty/zero magnitude)
  if (normA === 0 || normB === 0) {
    return 0;
  }

  // 6. Return the cosine of the angle between vectors (dot product divided by product of norms)
  return dotProduct / (normA * normB);
}

/**
 * Reads embeddings.json once and caches the index in memory.
 *
 * @returns {Promise<Array<Object>>}
 */
export async function loadIndex() {
  if (cachedIndex) {
    return cachedIndex;
  }

  const raw = await fs.readFile(EMBEDDINGS_FILE, 'utf-8');
  cachedIndex = JSON.parse(raw);
  return cachedIndex;
}

/**
 * Searches shop policies using semantic similarity.
 *
 * @param {string} query - Customer search question
 * @param {number} [topK=3] - Maximum number of relevant policy chunks to return
 * @returns {Promise<Array<{ source: string, heading: string, text: string, score: number }>>}
 */
export async function searchPolicies(query, topK = 3) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }

  // 1. Generate embedding vector for the customer's query
  const embedRes = await ollamaClient.embed({
    input: query.trim(),
    model: config.embedModel,
  });

  const queryEmbedding = embedRes.embeddings[0];

  // 2. Load cached policy chunks from memory
  const index = await loadIndex();

  // 3. Calculate cosine similarity score for every indexed policy chunk
  const scoredChunks = index.map((chunk) => {
    const score = cosineSimilarity(queryEmbedding, chunk.embedding);
    return {
      source: chunk.source,
      heading: chunk.heading,
      text: chunk.text,
      score: Number(score.toFixed(4)),
    };
  });

  // 4. Filter out chunks with similarity score below MIN_SCORE threshold
  const relevantChunks = scoredChunks.filter((chunk) => chunk.score >= MIN_SCORE);

  // 5. Sort descending by score and pick topK results
  relevantChunks.sort((a, b) => b.score - a.score);
  const results = relevantChunks.slice(0, topK);

  // 6. Console log retrieval results for observability
  console.log(`[rag] searchPolicies query: "${query}"`);
  if (results.length === 0) {
    console.log(`[rag] no matching policy above MIN_SCORE (${MIN_SCORE})`);
  } else {
    results.forEach((r, idx) => {
      console.log(`[rag] #${idx + 1} [score: ${r.score}] [${r.source}] ${r.heading}`);
    });
  }

  return results;
}

