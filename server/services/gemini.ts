import { GoogleGenAI, ThinkingLevel, type GenerateContentResponse } from '@google/genai';
import { getEnvConfig } from '../config/env.ts';

export class GeminiServiceError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 502, code = 'GEMINI_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function isGeminiConfigured(): boolean {
  const { geminiApiKey } = getEnvConfig();
  return Boolean(geminiApiKey && geminiApiKey !== 'MY_GEMINI_API_KEY' && geminiApiKey.length > 10);
}

function getClient(): GoogleGenAI {
  const { geminiApiKey } = getEnvConfig();
  if (!isGeminiConfigured()) {
    throw new GeminiServiceError(
      'AI Assistant is currently unavailable because GEMINI_API_KEY is not configured on the server. All non-AI features remain fully available.',
      503,
      'GEMINI_UNCONFIGURED'
    );
  }
  return new GoogleGenAI({
    apiKey: geminiApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function normalizeGeminiError(err: unknown): GeminiServiceError {
  if (err instanceof GeminiServiceError) return err;
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
    return new GeminiServiceError(
      'Gemini API authentication failed. Please check the server GEMINI_API_KEY in Settings > Secrets.',
      502,
      'GEMINI_AUTH_ERROR'
    );
  }
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429')) {
    return new GeminiServiceError(
      'AI service rate limit reached. Please wait a few moments and try again.',
      429,
      'GEMINI_RATE_LIMIT'
    );
  }
  if (msg.includes('NOT_FOUND') || msg.includes('404')) {
    return new GeminiServiceError(
      'Configured GEMINI_MODEL was not found or is unsupported.',
      502,
      'GEMINI_MODEL_NOT_FOUND'
    );
  }
  return new GeminiServiceError(`AI request failed: ${msg}`, 502, 'GEMINI_UPSTREAM_ERROR');
}

export async function generateGeminiText(params: {
  systemInstruction: string;
  contents: string | { role: 'user' | 'model'; parts: { text: string }[] }[];
  lowLatency?: boolean;
}): Promise<string> {
  const ai = getClient();
  const { geminiModel } = getEnvConfig();
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: geminiModel,
      contents: params.contents,
      config: {
        systemInstruction: params.systemInstruction,
        thinkingConfig: {
          thinkingLevel: params.lowLatency ? ThinkingLevel.LOW : ThinkingLevel.MEDIUM,
        },
      },
    });
    const text = response.text?.trim();
    if (!text) {
      throw new GeminiServiceError('AI returned an empty response. Please try rephrasing.', 502, 'GEMINI_EMPTY');
    }
    return text;
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}

export async function* streamGeminiText(params: {
  systemInstruction: string;
  contents: string | { role: 'user' | 'model'; parts: { text: string }[] }[];
}): AsyncGenerator<string> {
  const ai = getClient();
  const { geminiModel } = getEnvConfig();
  try {
    const stream = await ai.models.generateContentStream({
      model: geminiModel,
      contents: params.contents,
      config: {
        systemInstruction: params.systemInstruction,
        thinkingConfig: {
          thinkingLevel: ThinkingLevel.LOW,
        },
      },
    });
    for await (const chunk of stream) {
      const part = (chunk as GenerateContentResponse).text;
      if (part) {
        yield part;
      }
    }
  } catch (err) {
    throw normalizeGeminiError(err);
  }
}
