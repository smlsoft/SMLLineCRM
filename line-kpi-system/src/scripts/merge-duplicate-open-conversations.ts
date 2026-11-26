/**
 * Merges duplicate open conversations of one LINE group into a single open thread, so the
 * unique index "one open conversation per lineGroupId" (models/Conversation.ts) can build.
 *
 * Run (dry-run, changes nothing):  MONGODB_URI="..." node dist/scripts/merge-duplicate-open-conversations.js
 * Apply:                           MONGODB_URI="..." node dist/scripts/merge-duplicate-open-conversations.js --apply
 *
 * Per group with more than one open conversation the newest (by lastMessageAt) is kept.
 * Another open conversation within the gap window of it is a race sibling: its messages,
 * audit logs and triage items move to the kept one, whose counters are rebuilt from its
 * messages, and the sibling is deleted. An older one is only closed, as the resolver would do.
 * Reads MONGODB_URI from the environment only; it does not load .env.
 */
import mongoose, { Types } from 'mongoose';
import { Conversation } from '../models/Conversation';
import { Message } from '../models/Message';
import { AutoResolveLog } from '../models/AutoResolveLog';
import { TriageQueueItem } from '../models/TriageQueueItem';

const GAP_MS = parseInt(process.env.CONVERSATION_GAP_HOURS || '4', 10) * 60 * 60 * 1000;
const APPLY = process.argv.includes('--apply');
const MERGED_REASON = 'รวมบทสนทนาที่เปิดซ้ำของกลุ่มเดียวกัน';

type Conv = {
  _id: Types.ObjectId;
  lineGroupId: string;
  startedAt: Date;
  lastMessageAt: Date;
  messageCount: number;
};

async function rebuildCounters(convId: Types.ObjectId): Promise<void> {
  const msgs = await Message.find({ conversationId: convId })
    .select('senderType employeeId lineUserId timestamp')
    .sort({ timestamp: 1 })
    .lean();
  if (!msgs.length) return;
  const customers = msgs.filter((m) => m.senderType === 'customer');
  const employees = msgs.filter((m) => m.senderType === 'employee');
  const set: Record<string, unknown> = {
    startedAt: msgs[0].timestamp,
    lastMessageAt: msgs[msgs.length - 1].timestamp,
    messageCount: msgs.length,
    customerMessageCount: customers.length,
    employeeMessageCount: employees.length,
    participantCustomerIds: [...new Set(customers.map((m) => m.lineUserId))],
    participantEmployeeIds: [
      ...new Set(employees.filter((m) => m.employeeId).map((m) => String(m.employeeId))),
    ].map((id) => new Types.ObjectId(id)),
  };
  const unset: Record<string, ''> = {};
  if (customers.length) set.lastCustomerMessageAt = customers[customers.length - 1].timestamp;
  else unset.lastCustomerMessageAt = '';
  if (employees.length) set.lastEmployeeMessageAt = employees[employees.length - 1].timestamp;
  else unset.lastEmployeeMessageAt = '';
  await Conversation.updateOne(
    { _id: convId },
    Object.keys(unset).length ? { $set: set, $unset: unset } : { $set: set }
  );
}

async function mergeInto(keep: Conv, dup: Conv): Promise<void> {
  await Message.updateMany({ conversationId: dup._id }, { $set: { conversationId: keep._id } });

  // Proposals and queue items about the sibling describe a thread that no longer exists.
  await AutoResolveLog.updateMany(
    { conversationId: dup._id, status: 'pending_review' },
    { $set: { status: 'expired', expiredReason: MERGED_REASON } }
  );
  await AutoResolveLog.updateMany({ conversationId: dup._id }, { $set: { conversationId: keep._id } });
  await TriageQueueItem.updateMany(
    { conversationId: dup._id, status: { $in: ['pending', 'claimed'] } },
    { $set: { status: 'expired', expiredReason: MERGED_REASON } }
  );
  const items = await TriageQueueItem.find({ conversationId: dup._id }).select('_id').lean();
  for (const item of items) {
    try {
      await TriageQueueItem.updateOne({ _id: item._id }, { $set: { conversationId: keep._id } });
    } catch (err: unknown) {
      // The kept thread already has an item for the same snapshot time.
      if ((err as { code?: number }).code !== 11000) throw err;
      await TriageQueueItem.deleteOne({ _id: item._id });
    }
  }

  await rebuildCounters(keep._id);
  await Conversation.deleteOne({ _id: dup._id });
}

async function main(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000, autoIndex: false });
  console.log(`mode: ${APPLY ? 'APPLY' : 'dry-run'}  db: ${mongoose.connection.name}`);

  const groups = await Conversation.aggregate<{ _id: string; n: number }>([
    { $match: { status: 'open' } },
    { $group: { _id: '$lineGroupId', n: { $sum: 1 } } },
    { $match: { n: { $gt: 1 } } },
  ]);
  console.log(`groups with more than one open conversation: ${groups.length}`);

  let merged = 0;
  let closed = 0;
  for (const g of groups) {
    const convs = (await Conversation.find({ lineGroupId: g._id, status: 'open' })
      .select('lineGroupId startedAt lastMessageAt messageCount')
      .sort({ lastMessageAt: -1, _id: -1 })
      .lean()) as unknown as Conv[];
    const keep = convs[0];
    console.log(
      `\ngroup ${g._id}\n  keep   ${keep._id}  ${keep.startedAt.toISOString()} .. ${keep.lastMessageAt.toISOString()}  messages=${keep.messageCount}`
    );
    let earliest = keep.startedAt.getTime();
    for (const dup of convs.slice(1)) {
      const sibling = dup.lastMessageAt.getTime() >= earliest - GAP_MS;
      console.log(
        `  ${sibling ? 'merge ' : 'close '} ${dup._id}  ${dup.startedAt.toISOString()} .. ${dup.lastMessageAt.toISOString()}  messages=${dup.messageCount}`
      );
      if (sibling) {
        earliest = Math.min(earliest, dup.startedAt.getTime());
        merged++;
        if (APPLY) await mergeInto(keep, dup);
      } else {
        closed++;
        if (APPLY) await Conversation.updateOne({ _id: dup._id }, { $set: { status: 'closed' } });
      }
    }
  }

  console.log(`\n${APPLY ? 'done' : 'would do'}: merge=${merged} close=${closed}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error('ERROR:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
