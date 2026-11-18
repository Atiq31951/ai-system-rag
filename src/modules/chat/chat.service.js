import { config } from '../../config/index.js';
import { ollamaClient } from '../../infrastructure/ollama.client.js';
import { openrouterClient } from '../../infrastructure/openrouter.client.js';
import { buildSystemPrompt } from './chat.prompts.js';
import { tools, runTool } from './chat.tools.js';

const MAX_TOOL_ROUNDS = 10;

/**
 * Generates an AI customer support reply using Ollama or OpenRouter with tool calling.
 *
 * @param {string} text - User message text
 * @param {Object|null} user - User object { id, name, email } or null for guest
 * @returns {Promise<string>}
 */
export async function getReply(text, user) {
  const llmClient = config.useOpenRouter ? openrouterClient : ollamaClient;
  const systemPrompt = buildSystemPrompt(user);

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: text },
  ];

  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const response = await llmClient.chat({
      messages,
      tools,
      stream: false,
      think: false,
    });

    const assistantMessage = response.message;
    const toolCalls = assistantMessage.tool_calls;
    console.log("🚀 ~ getReply ~ toolCalls:", toolCalls)

    // If no tool was called, return the assistant's final text
    if (!toolCalls || toolCalls.length === 0) {
      return assistantMessage.content;
    }

    // 1. Push assistant message with tool_calls into conversation
    messages.push(assistantMessage);

    // 2. Execute each tool and push its result
    for (const toolCall of toolCalls) {
      const name = toolCall.function.name;
      const rawArgs = toolCall.function.arguments;
      const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs) : (rawArgs || {});

      const result = await runTool(name, args, user);

      // if (result && result.error) {
      //   console.log(`[round ${rounds}] ERROR ${name}`, args, '->', JSON.stringify(result.error));
      // } else {
      //   console.log(`[round ${rounds}] ${name}`, args);
      // }

      const toolMsg = {
        role: 'tool',
        content: JSON.stringify(result),
        tool_name: name,
        name,
      };

      if (toolCall.id) {
        toolMsg.tool_call_id = toolCall.id;
      }

      messages.push(toolMsg);
    }
  }


  return 'I am sorry, but I was unable to complete your request within the allowed steps.';
}
