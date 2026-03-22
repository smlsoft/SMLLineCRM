import { LineOa, ILineOa } from '../models/LineOa';

interface CachedOa {
  _id: string;
  channelId: string;
  channelSecret: string;
  channelAccessToken: string;
  displayName: string;
}

/**
 * In-memory cache of LINE OA configurations.
 * Used on every webhook request to verify the LINE signature
 * (requires channelSecret) and identify which OA received the event.
 *
 * Group routing is now handled by GroupRegistry (keyed by lineGroupId
 * extracted from the event payload) — not by OA config.
 */
class OaRegistry {
  private byChannelId = new Map<string, CachedOa>();
  private initialized = false;

  async initialize(): Promise<void> {
    const oas = await LineOa.find({ isActive: true })
      .select('channelId channelSecret channelAccessToken displayName')
      .lean<ILineOa[]>();

    this.byChannelId.clear();
    for (const oa of oas) {
      this.byChannelId.set(oa.channelId, {
        _id: oa._id.toString(),
        channelId: oa.channelId,
        channelSecret: oa.channelSecret,
        channelAccessToken: oa.channelAccessToken,
        displayName: oa.displayName,
      });
    }

    this.initialized = true;
    console.log(`[OaRegistry] Loaded ${this.byChannelId.size} LINE OAs`);
  }

  async refresh(): Promise<void> {
    await this.initialize();
  }

  getByChannelId(channelId: string): CachedOa | undefined {
    return this.byChannelId.get(channelId);
  }

  getAll(): CachedOa[] {
    return Array.from(this.byChannelId.values());
  }

  get size(): number {
    return this.byChannelId.size;
  }

  get isReady(): boolean {
    return this.initialized;
  }
}

// Singleton
export const oaRegistry = new OaRegistry();
