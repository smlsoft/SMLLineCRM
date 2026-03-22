import { messagingApi } from '@line/bot-sdk';
import { CustomerGroup, ICustomerGroup } from '../models/CustomerGroup';

interface CachedGroup {
  _id: string;
  lineGroupId: string;
  name: string;
  assignedOaId?: string;
}

/**
 * In-memory cache of LINE Group → CustomerGroup mappings.
 * One LINE OA can join many LINE Groups — each group is identified
 * by its lineGroupId (e.g. "C1234abcd"). This cache resolves that ID
 * to a CustomerGroup record on every incoming webhook message.
 *
 * Pattern mirrors MasterIdCache exactly.
 */
class GroupRegistry {
  private cache = new Map<string, CachedGroup>();
  private initialized = false;

  async initialize(): Promise<void> {
    const groups = await CustomerGroup.find({ isActive: true })
      .select('lineGroupId name assignedOaId')
      .lean<ICustomerGroup[]>();

    this.cache.clear();
    for (const g of groups) {
      this.cache.set(g.lineGroupId, {
        _id: g._id.toString(),
        lineGroupId: g.lineGroupId,
        name: g.name,
        assignedOaId: g.assignedOaId?.toString(),
      });
    }

    this.initialized = true;
    console.log(`[GroupRegistry] Loaded ${this.cache.size} customer groups`);
  }

  async refresh(): Promise<void> {
    await this.initialize();
  }

  getByLineGroupId(lineGroupId: string): CachedGroup | undefined {
    return this.cache.get(lineGroupId);
  }

  /**
   * Auto-registers an unknown group on first message — used when the OA
   * is already a member of a group that hasn't been registered yet.
   * Fetches group info from LINE, upserts CustomerGroup in DB, caches it.
   * Subsequent messages from the same group hit the in-memory cache (zero overhead).
   */
  async autoRegister(lineGroupId: string, oaAccessToken: string): Promise<CachedGroup> {
    // Fetch group name from LINE API
    let groupName = lineGroupId; // fallback to ID if API fails
    try {
      const client = new messagingApi.MessagingApiClient({ channelAccessToken: oaAccessToken });
      const summary = await client.getGroupSummary(lineGroupId);
      groupName = summary.groupName;
    } catch (err) {
      console.warn(`[GroupRegistry] Could not fetch group summary for ${lineGroupId}:`, err);
    }

    // Upsert CustomerGroup in DB
    const doc = await CustomerGroup.findOneAndUpdate(
      { lineGroupId },
      { name: groupName, isActive: true },
      { upsert: true, new: true }
    );

    const entry: CachedGroup = {
      _id: doc._id.toString(),
      lineGroupId,
      name: groupName,
      assignedOaId: doc.assignedOaId?.toString(),
    };

    // Add directly to in-memory cache — no full reload needed
    this.cache.set(lineGroupId, entry);
    console.log(`[GroupRegistry] Auto-registered group: "${groupName}" (${lineGroupId})`);

    return entry;
  }

  get size(): number {
    return this.cache.size;
  }

  get isReady(): boolean {
    return this.initialized;
  }
}

// Singleton
export const groupRegistry = new GroupRegistry();
