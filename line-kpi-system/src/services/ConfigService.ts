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

    this.cached = doc!;
    this.cachedAt = now;
    return this.cached;
  }

  async updateConfig(patch: Record<string, unknown>): Promise<ISystemConfig> {
    const doc = await SystemConfig.findOneAndUpdate(
      { _id: 'singleton' },
      { $set: { ...patch, updatedAt: new Date() } },
      { upsert: true, new: true }
    );

    this.cached = null; // clear cache so next read fetches fresh
    return doc!;
  }

  clearCache(): void {
    this.cached = null;
  }
}

export const configService = new ConfigService();
