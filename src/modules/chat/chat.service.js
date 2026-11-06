import { ollamaClient } from '../../infrastructure/ollama.client.js';
import { buildSystemPrompt } from './chat.prompts.js';

/**
 * Generates an AI customer support reply using Ollama.
 *
 * @param {string} text - User message text
 * @param {{ id: string, name: string, email: string } | null} user - Logged-in user, or null for guest
 * @returns {Promise<string>} Reply text from the model
 */

const allMessages = {};

export async function getReply(text, user) {
  const userId = user?.id || 'guest';

  if (!allMessages[userId]) {
    allMessages[userId] = [{ role: 'system', content: buildSystemPrompt(user) }];
  }

  allMessages[userId].push({
    role: "user",
    content: text
  })

  const response = await ollamaClient.chat({
    messages: allMessages[userId],
    stream: false,
    think: false,
  });

  allMessages[userId].push({ role: 'assistant', content: response.message.content });

  return response.message.content;
}
