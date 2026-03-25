import axios from 'axios';
import { configService } from '../ConfigService';
import { AiAdapter, AiTaskName } from './AiAdapter';
import { UniversalAdapter, UniversalAdapterConfig } from './UniversalAdapter';
import { IAiProviderGroup, IAiProviderInGroup } from '../../models/SystemConfig';
import { KNOWN_PROVIDERS_MAP } from './knownProviders';

interface Candidate {
  providerKey: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

function buildCandidates(group: IAiProviderGroup): Candidate[] {
  const candidates: Candidate[] = [];
  for (const p of group.providers) {
    if (!p.enabled) continue;
    if (p.models.length > 0) {
      for (const model of p.models) {
        candidates.push(resolveCandidate(p, model));
      }
    } else {
      // No models specified — let the adapter use whatever default
      candidates.push(resolveCandidate(p, ''));
    }
  }
  return candidates;
}

function resolveCandidate(p: IAiProviderInGroup, model: string): Candidate {
  const knownDef = KNOWN_PROVIDERS_MAP[p.providerKey];
  return {
    providerKey: p.providerKey,
    apiKey:      p.apiKey,
    baseUrl:     p.baseUrl || knownDef?.defaultBaseUrl || '',
    model,
  };
}

function createAdapter(c: Candidate): AiAdapter {
  const knownDef = KNOWN_PROVIDERS_MAP[c.providerKey];
  const cfg: UniversalAdapterConfig = {
    apiKey:       c.apiKey,
    model:        c.model,
    baseUrl:      c.baseUrl,
    authType:     knownDef?.authType ?? 'bearer',
    extraHeaders: knownDef?.extraHeaders,
    providerKey:  c.providerKey,
  };
  return new UniversalAdapter(cfg);
}

function isRetryable(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status ?? 0;
  if ([429, 402, 401, 502, 503, 504].includes(status)) return true;
  if (status === 400) {
    const body = JSON.stringify(err.response?.data ?? '').toLowerCase();
    return (
      body.includes('model') ||
      body.includes('endpoint') ||
      body.includes('not found') ||
      body.includes('no endpoints')
    );
  }
  return false;
}

function getErrMsg(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data?.error?.message) return String(data.error.message);
    if (data?.message) return String(data.message);
    return `HTTP ${err.response?.status ?? 'unknown'}`;
  }
  return err instanceof Error ? err.message : String(err);
}

export interface AdapterResolution {
  adapter: AiAdapter;
  providerName: string;
  modelName: string;
}

export interface FailoverResult<T> {
  result: T;
  providerName: string;
  modelName: string;
}

export class AiRouter {
  /**
   * Tries each (provider, model) candidate in priority order.
   * On retryable errors (429, 402, 401, 5xx, model-not-found) moves to the next candidate.
   * Throws if all candidates are exhausted.
   * Returns both the result and the provider/model that succeeded.
   */
  async callWithFailover<T>(
    task: AiTaskName,
    fn: (adapter: AiAdapter) => Promise<T>
  ): Promise<FailoverResult<T>> {
    const cfg = await configService.getConfig();
    const groupId = cfg.ai.tasks?.[task]?.groupId ?? 'grp_default';
    const group = cfg.ai.providerGroups[groupId];

    if (!group) {
      throw new Error(
        `[AiRouter] Provider group "${groupId}" not found for task "${task}". Please configure it in Settings.`
      );
    }

    const candidates = buildCandidates(group);
    if (candidates.length === 0) {
      throw new Error(
        `[AiRouter] No enabled providers in group "${group.name}" (groupId: ${groupId}) for task "${task}".`
      );
    }

    const errors: string[] = [];
    for (const c of candidates) {
      try {
        console.log(`[AiRouter] task=${task} → provider=${c.providerKey} model=${c.model || '(default)'}`);
        const adapter = createAdapter(c);
        const result = await fn(adapter);
        return { result, providerName: c.providerKey, modelName: c.model };
      } catch (err) {
        if (isRetryable(err)) {
          const msg = `${c.providerKey}/${c.model || 'default'}: ${getErrMsg(err)}`;
          console.warn(`[AiRouter] Retryable error — ${msg}. Trying next candidate...`);
          errors.push(msg);
          continue;
        }
        throw err;
      }
    }

    throw new Error(
      `[AiRouter] All providers exhausted for task "${task}": ${errors.join(' | ')}`
    );
  }

  /**
   * Returns the first available adapter for a task.
   * Used by test-ai route and other single-shot callers.
   */
  async getAdapterForTask(task: AiTaskName): Promise<AdapterResolution> {
    const cfg = await configService.getConfig();
    const groupId = cfg.ai.tasks?.[task]?.groupId ?? 'grp_default';
    const group = cfg.ai.providerGroups[groupId];

    if (!group) {
      throw new Error(`[AiRouter] Provider group "${groupId}" not found for task "${task}".`);
    }

    const candidates = buildCandidates(group);
    if (candidates.length === 0) {
      throw new Error(`[AiRouter] No enabled providers in group "${group.name}" for task "${task}".`);
    }

    const c = candidates[0];
    console.log(`[AiRouter] getAdapterForTask: task=${task} → provider=${c.providerKey} model=${c.model || '(default)'}`);
    return { adapter: createAdapter(c), providerName: c.providerKey, modelName: c.model };
  }
}

export const aiRouter = new AiRouter();
