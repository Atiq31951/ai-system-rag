import { config } from '../config/index.js';
import { AppError, BadRequestError } from './errors.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

/**
 * OpenRouter HTTP client supporting chat completions and tool/function calling.
 * Matches the interface expected by chat.service.js.
 */
export class OpenRouterClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.apiKey] - OpenRouter API key
   * @param {string} [options.defaultModel] - Default model identifier
   * @param {number} [options.timeoutMs=60000] - Request timeout in milliseconds
   */
  constructor({
    apiKey = config.openrouterApiKey,
    defaultModel = config.openrouterModel,
    timeoutMs = 60000,
  } = {}) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Sends a conversational chat completion request to OpenRouter.
   *
   * @param {Object} options
   * @param {Array<Object>} options.messages - List of conversation messages
   * @param {string} [options.model] - Model name (overrides default model)
   * @param {Array<Object>} [options.tools] - Tools for function calling
   * @param {AbortSignal} [options.signal] - Optional external abort signal
   * @returns {Promise<{ model: string, message: { role: string, content: string, tool_calls?: Array<Object>|null }, raw: Object }>}
   */
  async chat({
    messages,
    model = this.defaultModel,
    tools,
    signal,
  } = {}) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestError('Chat requires a non-empty "messages" array');
    }

    if (!this.apiKey) {
      throw new AppError(
        'OpenRouter API key is missing. Set OPENROUTER_API_KEY in .env',
        401,
        'OPENROUTER_AUTH_ERROR'
      );
    }

    const payload = {
      model,
      messages,
    };

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const requestSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'Ecommerce AI Support',
        },
        body: JSON.stringify(payload),
        signal: requestSignal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorMessage = `OpenRouter API request failed with status ${response.status}`;
        let errorDetails = null;

        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.error && errorBody.error.message) {
            errorMessage = errorBody.error.message;
            errorDetails = errorBody;
          }
        } catch {
          errorMessage = response.statusText || errorMessage;
        }

        const statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
        throw new AppError(errorMessage, statusCode, 'OPENROUTER_API_ERROR', errorDetails);
      }

      const data = await response.json();
      const choice = data.choices && data.choices[0];

      if (!choice || !choice.message) {
        throw new AppError(
          'OpenRouter returned an unexpected response structure',
          502,
          'OPENROUTER_INVALID_RESPONSE',
          data
        );
      }

      return {
        model: data.model,
        message: {
          role: choice.message.role || 'assistant',
          content: choice.message.content || '',
          tool_calls: choice.message.tool_calls || null,
        },
        raw: data,
      };
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof AppError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new AppError(
          `OpenRouter request timed out after ${this.timeoutMs}ms`,
          504,
          'OPENROUTER_TIMEOUT'
        );
      }

      throw new AppError(
        `Failed to connect to OpenRouter: ${err.message}`,
        503,
        'OPENROUTER_UNAVAILABLE',
        { originalError: err.message }
      );
    }
  }
}

/**
 * Pre-configured singleton OpenRouter client using environment configurations.
 */
export const openrouterClient = new OpenRouterClient();

