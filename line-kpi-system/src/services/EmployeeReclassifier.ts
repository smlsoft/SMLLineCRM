import { Types } from 'mongoose';
import { Message } from '../models/Message';
import { Conversation } from '../models/Conversation';

/**
 * Re-classifies today's messages that were wrongly stored as 'customer'
 * because the employee wasn't in MasterIdCache at the time of the webhook.
 *
 * เรียกหลังเพิ่ม/แก้ไข Employee เพื่อให้สถานะ monitor ถูกต้อง
 *
 * ขั้นตอน:
 * 1. หา Message วันนี้ที่มี lineUserId ตรง แต่ senderType = 'customer' (ถูก classify ผิด)
 * 2. Update senderType → 'employee' + ใส่ employeeId
 * 3. Recalculate Conversation metrics (lastCustomerMessageAt, lastEmployeeMessageAt, counts, participants)
 */
export async function reclassifyEmployeeMessages(
  lineUserId: string,
  employeeId: Types.ObjectId
): Promise<void> {
  const now = new Date();
  const todayStart = new Date(
    `${now.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' })}T00:00:00+07:00`
  );
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  // 1. หา messages ที่ classify ผิด
  const wrongMessages = await Message.find({
    lineUserId,
    senderType: 'customer',
    timestamp: { $gte: todayStart, $lt: todayEnd },
  })
    .select('conversationId')
    .lean();

  if (wrongMessages.length === 0) return;

  const affectedConversationIds = [
    ...new Set(wrongMessages.map((m) => m.conversationId.toString())),
  ].map((id) => new Types.ObjectId(id));

  // 2. Re-classify
  const { modifiedCount } = await Message.updateMany(
    {
      lineUserId,
      senderType: 'customer',
      timestamp: { $gte: todayStart, $lt: todayEnd },
    },
    { $set: { senderType: 'employee', employeeId } }
  );

  console.info(
    `[EmployeeReclassifier] Re-classified ${modifiedCount} messages` +
    ` for lineUserId=${lineUserId} (employeeId=${employeeId})`
  );

  // 3. Recalculate metrics ของทุก conversation ที่ได้รับผลกระทบ
  for (const conversationId of affectedConversationIds) {
    await recalculateConversationMetrics(conversationId);
  }
}

/**
 * คำนวณ metrics ของ Conversation ใหม่จาก Message collection จริง
 * (แทนที่ค่า denormalized ที่ผิดพลาด)
 */
async function recalculateConversationMetrics(conversationId: Types.ObjectId): Promise<void> {
  // Customer stats
  const [custResult] = await Message.aggregate<{
    count: number;
    lastAt: Date | null;
    participants: string[];
  }>([
    { $match: { conversationId, senderType: 'customer' } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        lastAt: { $max: '$timestamp' },
        participants: { $addToSet: '$lineUserId' },
      },
    },
  ]);

  // Employee stats
  const [empResult] = await Message.aggregate<{
    count: number;
    lastAt: Date | null;
    participants: Types.ObjectId[];
  }>([
    { $match: { conversationId, senderType: 'employee', employeeId: { $ne: null } } },
    {
      $group: {
        _id: null,
        count: { $sum: 1 },
        lastAt: { $max: '$timestamp' },
        participants: { $addToSet: '$employeeId' },
      },
    },
  ]);

  const setFields: Record<string, unknown> = {
    customerMessageCount: custResult?.count ?? 0,
    employeeMessageCount: empResult?.count ?? 0,
    participantCustomerIds: custResult?.participants ?? [],
    participantEmployeeIds: empResult?.participants ?? [],
  };

  const unsetFields: Record<string, string> = {};

  if (custResult?.lastAt) {
    setFields.lastCustomerMessageAt = custResult.lastAt;
  } else {
    // ไม่มี customer message เลย — unset field เพื่อให้ monitor คำนวณถูก
    unsetFields.lastCustomerMessageAt = '';
  }

  if (empResult?.lastAt) {
    setFields.lastEmployeeMessageAt = empResult.lastAt;
  } else {
    unsetFields.lastEmployeeMessageAt = '';
  }

  const updateOp: Record<string, unknown> = { $set: setFields };
  if (Object.keys(unsetFields).length > 0) {
    updateOp.$unset = unsetFields;
  }

  await Conversation.updateOne({ _id: conversationId }, updateOp);

  console.info(`[EmployeeReclassifier] Recalculated conversation ${conversationId}`);
}
