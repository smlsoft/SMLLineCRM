import axios from 'axios';
import { configService } from '../ConfigService';
import {
  AiAdapter,
  GroupSummaryParams,
  GroupSummaryResult,
  StaffKpiParams,
  StaffKpiResult,
  IssueAnalysisParams,
  IssueAnalysisResult,
  IssueCategory,
  ResolutionResult,
} from './AiAdapter';
import { buildGroupSummaryPrompt } from '../../jobs/prompts/groupSummary';
import { buildStaffKpiPrompt } from '../../jobs/prompts/staffKpi';
import { buildIssueAnalysisPrompt } from '../../jobs/prompts/issueAnalysis';
import { buildResolutionAnalysisPrompt, ResolutionAnalysisParams } from '../../jobs/prompts/resolutionAnalysis';

/**
 * Kilo AI adapter — OpenAI-compatible API format.
 * Swap KILO_BASE_URL / KILO_MODEL / KILO_API_KEY in .env to use.
 */
export class KiloAdapter implements AiAdapter {
  async generateGroupSummary(params: GroupSummaryParams): Promise<GroupSummaryResult> {
    const prompt = buildGroupSummaryPrompt(params);
    const raw = await this.chat(prompt);
    const parsed = this.parseJson<{ summaryText: string; topIssues: string[]; sentimentScore?: number }>(raw.content);

    return {
      summaryText: parsed.summaryText ?? '',
      topIssues: parsed.topIssues ?? [],
      sentimentScore: parsed.sentimentScore,
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
    };
  }

  async evaluateStaffKpi(params: StaffKpiParams): Promise<StaffKpiResult> {
    const prompt = buildStaffKpiPrompt(params);
    const raw = await this.chat(prompt);
    const parsed = this.parseJson<{
      qualityScore: number;
      kpiNarrative: string;
      strengths: string[];
      areasToImprove: string[];
    }>(raw.content);

    return {
      qualityScore: parsed.qualityScore ?? 5,
      kpiNarrative: parsed.kpiNarrative ?? '',
      strengths: parsed.strengths ?? [],
      areasToImprove: parsed.areasToImprove ?? [],
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
    };
  }

  async analyzeIssues(params: IssueAnalysisParams): Promise<IssueAnalysisResult> {
    const prompt = buildIssueAnalysisPrompt(params);
    const raw = await this.chat(prompt);
    const parsed = this.parseJson<{
      issueCategories: IssueCategory[];
      recurringIssues: string[];
      emergingIssues: string[];
      rootCauseInsight: string;
      recommendedActions: string[];
    }>(raw.content);

    return {
      issueCategories: parsed.issueCategories ?? [],
      recurringIssues: parsed.recurringIssues ?? [],
      emergingIssues: parsed.emergingIssues ?? [],
      rootCauseInsight: parsed.rootCauseInsight ?? '',
      recommendedActions: parsed.recommendedActions ?? [],
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
    };
  }

  async analyzeResolution(params: ResolutionAnalysisParams): Promise<ResolutionResult> {
    const prompt = buildResolutionAnalysisPrompt(params);
    const raw = await this.chat(prompt);
    const parsed = this.parseJson<{ resolution: 'resolved' | 'unresolved'; reason: string }>(raw.content);

    return {
      resolution: parsed.resolution === 'resolved' ? 'resolved' : 'unresolved',
      reason: parsed.reason ?? '',
      promptTokens: raw.promptTokens,
      completionTokens: raw.completionTokens,
    };
  }

  private async chat(userMessage: string): Promise<{ content: string; promptTokens: number; completionTokens: number }> {
    const cfg = await configService.getConfig();
    const { apiKey, model, baseUrl } = cfg.ai.kilo;

    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: userMessage }],
        temperature: 0.3,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const choice = response.data.choices?.[0];
    const usage = response.data.usage ?? {};
    return {
      content: choice?.message?.content ?? '{}',
      promptTokens: usage.prompt_tokens ?? 0,
      completionTokens: usage.completion_tokens ?? 0,
    };
  }

  private parseJson<T>(raw: string): Partial<T> {
    // Strip markdown code fences if model wraps JSON
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      console.warn('[KiloAdapter] Failed to parse JSON response:', raw.slice(0, 200));
      return {};
    }
  }
}
