import { JoinEvent } from '@line/bot-sdk';
import { messagingApi } from '@line/bot-sdk';
import { CustomerGroup } from '../../models/CustomerGroup';
import { groupRegistry } from '../../services/GroupRegistry';

/**
 * Handles LINE join events — fired when the OA bot is added to a group/room.
 * Auto-registers the group as a CustomerGroup so messages are accepted immediately.
 */
export async function handleJoinEvent(
  event: JoinEvent,
  oaAccessToken: string
): Promise<void> {
  const source = event.source;

  if (source.type !== 'group') {
    // Room or user — skip (we only track groups)
    return;
  }

  const lineGroupId = source.groupId;

  // Idempotent — skip if already registered
  const existing = groupRegistry.getByLineGroupId(lineGroupId);
  if (existing) {
    console.log(`[JoinEvent] Group already registered: ${lineGroupId}`);
    return;
  }

  // Fetch group name from LINE API
  let groupName = lineGroupId; // fallback
  try {
    const client = new messagingApi.MessagingApiClient({ channelAccessToken: oaAccessToken });
    const summary = await client.getGroupSummary(lineGroupId);
    groupName = summary.groupName;
  } catch (err) {
    console.warn(`[JoinEvent] Could not fetch group summary for ${lineGroupId}:`, err);
  }

  // Auto-create CustomerGroup
  await CustomerGroup.findOneAndUpdate(
    { lineGroupId },
    { name: groupName, isActive: true },
    { upsert: true, new: true }
  );

  // Refresh in-memory registry so messages are accepted immediately
  await groupRegistry.refresh();

  console.log(`[JoinEvent] Auto-registered group: "${groupName}" (${lineGroupId})`);
}
