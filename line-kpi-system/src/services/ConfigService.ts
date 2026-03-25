import { SystemConfig, ISystemConfig } from '../models/SystemConfig';

const CACHE_TTL_MS = 60_000;

class ConfigService {
  private cached: ISystemConfig | null = null;
  private cachedAt = 0;

  async getConfig(): Promise<ISystemConfig> {
    const now = Date.now();
    if (this.cached && now - this.cachedAt < CACHE_TTL_MS) {
      return this.cached;
    }

    // Upsert default doc if it doesn't exist yet
    const doc = await SystemConfig.findOneAndUpdate(
      { _id: 'singleton' },
      { $setOnInsert: { _id: 'singleton' } },
      { upsert: true, new: true }
    );

    // Flatten Mongoose Maps to plain objects for consistent access
    const raw = doc!.toObject({ flattenMaps: true }) as ISystemConfig;

    // ---- Migration 1: old ai.openrouter / ai.kilo flat fields → ai.providers map (legacy) ----
    const rawAi = raw.ai as Record<string, unknown>;
    if ((rawAi['openrouter'] || rawAi['kilo']) && !rawAi['providers'] && !rawAi['providerGroups']) {
      console.log('[ConfigService] Migration 1: old flat AI fields → ai.providers...');
      const oldOr = rawAi['openrouter'] as { apiKey?: string; model?: string; baseUrl?: string } | undefined;
      const oldKilo = rawAi['kilo'] as { apiKey?: string; model?: string; baseUrl?: string } | undefined;
      const patch: Record<string, unknown> = {};
      if (oldOr) {
        patch['ai.providers.openrouter.apiKey']       = oldOr.apiKey ?? '';
        patch['ai.providers.openrouter.defaultModel'] = oldOr.model ?? '';
        patch['ai.providers.openrouter.baseUrl']      = oldOr.baseUrl ?? '';
      }
      if (oldKilo) {
        patch['ai.providers.kilo.apiKey']       = oldKilo.apiKey ?? '';
        patch['ai.providers.kilo.defaultModel'] = oldKilo.model ?? '';
        patch['ai.providers.kilo.baseUrl']      = oldKilo.baseUrl ?? '';
      }
      await SystemConfig.updateOne(
        { _id: 'singleton' },
        { $set: patch, $unset: { 'ai.openrouter': '', 'ai.kilo': '', 'ai.provider': '' } },
        { strict: false }
      );
      // Fall through to Migration 2 with re-fetched doc
      const refetched = await SystemConfig.findOne({ _id: 'singleton' });
      Object.assign(rawAi, refetched!.toObject({ flattenMaps: true }).ai as Record<string, unknown>);
    }

    // ---- Migration 2: ai.providers + ai.routing (tier-based) → ai.providerGroups + ai.tasks ----
    if (rawAi['providers'] || rawAi['routing']) {
      console.log('[ConfigService] Migration 2: tier-based config → provider groups...');

      type OldProvider = { apiKey?: string; defaultModel?: string; baseUrl?: string };
      const oldProviders = rawAi['providers'] as Record<string, OldProvider> | undefined;
      const oldRouting = rawAi['routing'] as {
        tiers?: { standard?: { provider?: string } };
      } | undefined;

      // Pick the provider from the 'standard' tier, or first available
      const defaultProviderKey =
        oldRouting?.tiers?.standard?.provider ??
        (oldProviders ? Object.keys(oldProviders)[0] : null) ??
        'openrouter';

      const p = oldProviders?.[defaultProviderKey];

      await SystemConfig.updateOne(
        { _id: 'singleton' },
        {
          $set: {
            'ai.providerGroups.grp_default': {
              name: 'Default Group (migrated)',
              providers: p
                ? [
                    {
                      providerKey: defaultProviderKey,
                      apiKey:      p.apiKey ?? '',
                      baseUrl:     p.baseUrl ?? '',
                      models:      p.defaultModel ? [p.defaultModel] : [],
                      enabled:     true,
                    },
                  ]
                : [],
            },
            'ai.tasks.issueAnalysis.groupId': 'grp_default',
          },
          $unset: { 'ai.providers': '', 'ai.routing': '' },
        },
        { strict: false }  // required: these old fields are not in current schema
      );

      const migrated = await SystemConfig.findOne({ _id: 'singleton' });
      const migratedRaw = migrated!.toObject({ flattenMaps: true }) as ISystemConfig;
      this.cached = migratedRaw;
      this.cachedAt = now;
      return this.cached;
    }

    // ---- Migration 3: old jobs.dailyEvaluation / jobs.issueAnalysis → jobs.dailyAnalysis ----
    const rawJobs = raw.jobs as Record<string, unknown>;
    if (rawJobs['dailyEvaluation'] !== undefined || rawJobs['issueAnalysis'] !== undefined) {
      console.log('[ConfigService] Migration 3: jobs config → dailyAnalysis...');
      const oldEnabled =
        (rawJobs['dailyEvaluation'] as { enabled?: boolean } | undefined)?.enabled ?? true;
      await SystemConfig.updateOne(
        { _id: 'singleton' },
        {
          $set: { 'jobs.dailyAnalysis.enabled': oldEnabled },
          $unset: { 'jobs.dailyEvaluation': '', 'jobs.issueAnalysis': '' },
        },
        { strict: false }
      );
      const migrated = await SystemConfig.findOne({ _id: 'singleton' });
      const migratedRaw = migrated!.toObject({ flattenMaps: true }) as ISystemConfig;
      this.cached = migratedRaw;
      this.cachedAt = now;
      return this.cached;
    }

    this.cached = raw;
    this.cachedAt = now;
    return this.cached;
  }

  async updateConfig(patch: Record<string, unknown>): Promise<ISystemConfig> {
    const doc = await SystemConfig.findOneAndUpdate(
      { _id: 'singleton' },
      { $set: { ...patch, updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    this.cached = null;
    const raw = doc!.toObject({ flattenMaps: true }) as ISystemConfig;
    return raw;
  }

  clearCache(): void {
    this.cached = null;
  }
}

export const configService = new ConfigService();
