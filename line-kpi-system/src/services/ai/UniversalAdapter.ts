import axios from 'axios';
import {
  AiAdapter,
  AdapterConfig,
  DailyConversationAnalysisParams,
} from './AiAdapter';
import { AiAuthType } from './knownProviders';
import { buildDailyAnalysisPrompt, ConversationCategoryResult } from '../../jobs/prompts/dailyAnalysis';

export interface UniversalAdapterConfig extends AdapterConfig {
  authType?: AiAuthType;           // defaults to 'bearer'
  extraHeaders?: Record<string, string>;
  /** Provider key — used for response format normalization */
  providerKey?: string;
}

export class UniversalAdapter implements AiAdapter {
  constructor(private cfg: UniversalAdapterConfig) {}

  async analyzeDailyConversations(params: DailyConversationAnalysisParams): Promise<ConversationCategoryResult[]> {
    const prompt = buildDailyAnalysisPrompt(params);
    const raw = await this.chat(prompt);
    // AI returns a JSON array directly
    const cleaned = raw.content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    // Find the array in the response (in case AI adds extra text)
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      console.warn('[UniversalAdapter] No JSON array in analyzeDailyConversations response:', raw.content.slice(0, 200));
      return [];
    }
    try {
      const parsed = JSON.parse(match[0]) as ConversationCategoryResult[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      console.warn('[UniversalAdapter] Failed to parse analyzeDailyConversations response:', raw.content.slice(0, 200));
      return [];
    }
  }

  private buildHeaders(): Record<string, string> {
    const { apiKey, authType = 'bearer', extraHeaders } = this.cfg;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (authType === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (authType === 'x-api-key') {
      headers['x-api-key'] = apiKey;
    }
    // 'query-param' — no auth header; key appended to URL in buildChatUrl()

    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
    }
    return headers;
  }

  private buildChatUrl(): string {
    const { baseUrl, apiKey, authType = 'bearer' } = this.cfg;
    const path = `${baseUrl}/chat/completions`;
    if (authType === 'query-param') {
      return `${path}?key=${encodeURIComponent(apiKey)}`;
    }
    return path;
  }

  private extractContent(responseData: unknown): string {
    const data = responseData as Record<string, unknown>;
    // Anthropic native format: { content: [{ type: 'text', text: '...' }] }
    if (this.cfg.providerKey === 'anthropic' && Array.isArray(data.content)) {
      return (data.content as Array<{ text: string }>)[0]?.text ?? '[]';
    }
    // Standard OpenAI-compatible: { choices: [{ message: { content: '...' } }] }
    const choices = data.choices as Array<{ message: { content: string } }> | undefined;
    return choices?.[0]?.message?.content ?? '[]';
  }

  private async chat(userMessage: string): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    const { model, providerKey } = this.cfg;

    // Anthropic uses a different request body format
    const body = providerKey === 'anthropic'
      ? { model, max_tokens: 4096, messages: [{ role: 'user', content: userMessage }] }
      : { model, messages: [{ role: 'user', content: userMessage }], temperature: 0.3 };

    const response = await axios.post(
      this.buildChatUrl(),
      body,
      { headers: this.buildHeaders(), timeout: 120000 }
    );

    const content = this.extractContent(response.data);
    const usage = response.data.usage ?? {};
    return {
      content,
      promptTokens: usage.prompt_tokens ?? usage.input_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? usage.output_tokens ?? 0,
    };
  }
}
