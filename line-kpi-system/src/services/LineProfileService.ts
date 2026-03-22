import { messagingApi } from '@line/bot-sdk';
import { LineProfile } from '../models/LineProfile';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Fetches and caches LINE display names.
 * Uses MongoDB as the cache store with a 24-hour TTL.
 * Falls back to lineUserId if the LINE API call fails.
 */
export class LineProfileService {
  async getDisplayName(
    lineUserId: string,
    lineGroupId: string,
    channelAccessToken: string
  ): Promise<string> {
    const cached = await LineProfile.findOne({ lineUserId }).lean();
    if (cached && Date.now() - cached.refreshedAt.getTime() < CACHE_TTL_MS) {
      return cached.displayName;
    }

    try {
      const client = new messagingApi.MessagingApiClient({ channelAccessToken });
      const profile = await client.getGroupMemberProfile(lineGroupId, lineUserId);

      await LineProfile.findOneAndUpdate(
        { lineUserId },
        {
          displayName: profile.displayName,
          pictureUrl: profile.pictureUrl,
          refreshedAt: new Date(),
        },
        { upsert: true, new: true }
      );

      return profile.displayName;
    } catch (err) {
      console.warn(`[LineProfileService] Failed to fetch profile for ${lineUserId}:`, err);
      return cached?.displayName ?? lineUserId;
    }
  }
}

export const lineProfileService = new LineProfileService();
