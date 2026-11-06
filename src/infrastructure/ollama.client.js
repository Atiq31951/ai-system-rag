import { config } from '../config/index.js';
import { AppError, BadRequestError } from './errors.js';

/**
 * @typedef {Object} ChatMessage
 * @property {'system' | 'user' | 'assistant' | 'tool'} role
 * @property {string} content
 * @property {Array<Object>} [tool_calls]
 */

/**
 * @typedef {Object} ChatOptions
 * @property {Array<ChatMessage>} messages - List of conversation messages
 * @property {string} [model] - Model name (overrides default env model)
 * @property {Array<Object>} [tools] - Tools for function calling
 * @property {'json' | Object} [format] - Output format (e.g. 'json' or JSON schema)
 * @property {Record<string, unknown>} [options] - Model runtime options (temperature, num_predict, etc.)
 * @property {boolean} [stream=false] - Whether to stream the response
 * @property {AbortSignal} [signal] - Optional external abort signal
 */

/**
 * @typedef {Object} GenerateOptions
 * @property {string} prompt - Raw prompt string
 * @property {string} [model] - Model name (overrides default env model)
 * @property {string} [system] - System prompt override
 * @property {'json' | Object} [format] - Output format
 * @property {Record<string, unknown>} [options] - Model runtime options
 * @property {boolean} [stream=false] - Whether to stream the response
 * @property {AbortSignal} [signal] - Optional external abort signal
 */

/**
 * Ollama HTTP client supporting model flexibility, chat completions, function calling,
 * embeddings, and streaming.
 */
export class OllamaClient {
  /**
   * @param {Object} [options]
   * @param {string} [options.baseUrl] - Base URL for Ollama (defaults to config.ollamaBaseUrl)
   * @param {string} [options.defaultModel] - Default model name (defaults to config.ollamaModel)
   * @param {number} [options.timeoutMs=60000] - Request timeout in milliseconds
   */
  constructor({
    baseUrl = config.ollamaBaseUrl,
    defaultModel = config.ollamaModel,
    timeoutMs = 60000,
  } = {}) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultModel = defaultModel;
    this.timeoutMs = timeoutMs;
  }

  /**
   * Internal request handler with timeouts, error mapping, and JSON handling.
   *
   * @private
   * @param {string} endpoint
   * @param {Object} [options]
   * @param {'GET' | 'POST' | 'DELETE'} [options.method='POST']
   * @param {unknown} [options.body]
   * @param {number} [options.timeoutMs]
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<Response>}
   */

  async #request(endpoint, { method = 'POST', body, timeoutMs = this.timeoutMs, signal } = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const requestSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: requestSignal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        let errorMessage = `Ollama API request failed with status ${response.status}`;
        let errorDetails = null;

        try {
          const errorBody = await response.json();
          if (errorBody && errorBody.error) {
            errorMessage = errorBody.error;
            errorDetails = errorBody;
          }
        } catch {
          errorMessage = response.statusText || errorMessage;
        }

        const statusCode = response.status >= 400 && response.status < 500 ? response.status : 502;
        throw new AppError(errorMessage, statusCode, 'OLLAMA_API_ERROR', errorDetails);
      }

      return response;
    } catch (err) {
      clearTimeout(timer);

      if (err instanceof AppError) {
        throw err;
      }

      if (err.name === 'AbortError') {
        throw new AppError(`Ollama request timed out after ${timeoutMs}ms`, 504, 'OLLAMA_TIMEOUT');
      }

      throw new AppError(
        `Failed to connect to Ollama at ${this.baseUrl}: ${err.message}. Ensure Ollama is running.`,
        503,
        'OLLAMA_UNAVAILABLE',
        { originalError: err.message, baseUrl: this.baseUrl }
      );
    }
  }

  /**
   * Helper generator to read NDJSON streams line-by-line.
   *
   * @private
   * @param {ReadableStream<Uint8Array>} body
   * @returns {AsyncGenerator<Object, void, unknown>}
   */
  async *#readNdjsonStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) {
            try {
              yield JSON.parse(trimmed);
            } catch {
              // Ignore partial JSON fragments
            }
          }
        }
      }

      if (buffer.trim()) {
        try {
          yield JSON.parse(buffer.trim());
        } catch {
          // Ignore partial JSON fragments
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Sends a conversational chat completion request (/api/chat).
   * Supports custom models, tool calls (function calling), and streaming.
   *
   * @param {ChatOptions} options
   * @returns {Promise<Object | AsyncGenerator<Object, void, unknown>>}
   */
  async chat({
    messages,
    model = this.defaultModel,
    tools,
    format,
    options,
    stream = false,
    think,
    signal,
  } = {}) {
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      throw new BadRequestError('Chat requires a non-empty "messages" array');
    }

    const payload = {
      model,
      messages,
      stream: Boolean(stream),
    };

    if (think !== undefined) {
      payload.think = think;
    }

    if (tools && Array.isArray(tools) && tools.length > 0) {
      payload.tools = tools;
    }
    if (format) {
      payload.format = format;
    }
    if (options && typeof options === 'object') {
      payload.options = options;
    }

    const response = await this.#request('/api/chat', { body: payload, signal });

    if (stream) {
      return this.#readNdjsonStream(response.body);
    }

    const data = await response.json();
    return {
      model: data.model,
      message: data.message,
      done: data.done,
      totalDuration: data.total_duration,
      promptEvalCount: data.prompt_eval_count,
      evalCount: data.eval_count,
      raw: data,
    };
  }

  /**
   * Generates completion for a single prompt (/api/generate).
   *
   * @param {GenerateOptions} options
   * @returns {Promise<Object | AsyncGenerator<Object, void, unknown>>}
   */
  async generate({
    prompt,
    model = this.defaultModel,
    system,
    format,
    options,
    stream = false,
    signal,
  } = {}) {
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      throw new BadRequestError('Generate requires a non-empty "prompt" string');
    }

    const payload = {
      model,
      prompt,
      stream: Boolean(stream),
    };

    if (system) {
      payload.system = system;
    }
    if (format) {
      payload.format = format;
    }
    if (options && typeof options === 'object') {
      payload.options = options;
    }

    const response = await this.#request('/api/generate', { body: payload, signal });

    if (stream) {
      return this.#readNdjsonStream(response.body);
    }

    const data = await response.json();
    return {
      model: data.model,
      response: data.response,
      done: data.done,
      totalDuration: data.total_duration,
      promptEvalCount: data.prompt_eval_count,
      evalCount: data.eval_count,
      raw: data,
    };
  }

  /**
   * Generates text embeddings for RAG and semantic search (/api/embed).
   *
   * @param {Object} options
   * @param {string | Array<string>} options.input - Text or list of texts to embed
   * @param {string} [options.model] - Model name (overrides default env model)
   * @param {AbortSignal} [options.signal]
   * @returns {Promise<{ model: string, embeddings: Array<Array<number>> }>}
   */
  async embed({ input, model = this.defaultModel, signal } = {}) {
    if (!input || (typeof input !== 'string' && !Array.isArray(input))) {
      throw new BadRequestError('Embed requires an "input" of type string or array of strings');
    }

    const payload = { model, input };

    try {
      const response = await this.#request('/api/embed', { body: payload, signal });
      const data = await response.json();
      return {
        model: data.model,
        embeddings: data.embeddings,
      };
    } catch (err) {
      // Fallback for older Ollama versions that only support /api/embeddings for single text
      if (err.statusCode === 404 && typeof input === 'string') {
        const fallbackRes = await this.#request('/api/embeddings', {
          body: { model, prompt: input },
          signal,
        });
        const fallbackData = await fallbackRes.json();
        return {
          model: fallbackData.model || model,
          embeddings: [fallbackData.embedding],
        };
      }
      throw err;
    }
  }

  /**
   * Lists all locally installed models in Ollama (/api/tags).
   *
   * @param {AbortSignal} [signal]
   * @returns {Promise<Array<{ name: string, model: string, size: number, modified_at: string }>>}
   */
  async listModels(signal) {
    const response = await this.#request('/api/tags', { method: 'GET', signal });
    const data = await response.json();
    return data.models || [];
  }

  /**
   * Health check to test if Ollama server is reachable.
   *
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Pre-configured singleton Ollama client using environment configurations.
 */
export const ollamaClient = new OllamaClient();

