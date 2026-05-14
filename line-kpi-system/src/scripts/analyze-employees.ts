/**
 * Employee Performance Analysis Script
 * รัน: MONGODB_URI="..." npx ts-node src/scripts/analyze-employees.ts
 */
import mongoose from 'mongoose';

// ─── Minimal schemas (standalone, ไม่ import models หลัก) ───────────────────

const EmployeeSchema = new mongoose.Schema(
  { employeeCode: String, name: String, isActive: Boolean, createdAt: Date },
  { collection: 'employees' }
);

const MessageSchema = new mongoose.Schema(
  {
    employeeId: mongoose.Schema.Types.ObjectId,
    senderType: String,
    responseGapMs: Number,
    timestamp: Date,
  },
  { collection: 'messages' }
);

const ConversationSchema = new mongoose.Schema(
  {
    participantEmployeeIds: [mongoose.Schema.Types.ObjectId],
    firstResponseMs: Number,
    avgResponseMs: Number,
    maxResponseMs: Number,
    issueCategory: String,
    date: Date,
    startedAt: Date,
  },
  { collection: 'conversations' }
);

const Employee = mongoose.model('Employee', EmployeeSchema);
const Message = mongoose.model('Message', MessageSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return 'N/A';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs} วินาที`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins} นาที ${remSecs > 0 ? `${remSecs} วินาที` : ''}`.trim();
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs} ชม. ${remMins > 0 ? `${remMins} นาที` : ''}`.trim();
}

function fmtNum(n: number): string {
  return n.toLocaleString('th-TH');
}

function progressBar(pct: number, width = 18): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(Math.max(0, width - filled));
}

function center(text: string, width: number): string {
  const pad = Math.max(0, width - text.length);
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + text + ' '.repeat(pad - left);
}

// ─── Database detection ──────────────────────────────────────────────────────

async function detectDatabase(uri: string): Promise<string | null> {
  // If URI already has a path component (db name), use it
  const match = uri.match(/mongodb(?:\+srv)?:\/\/[^/]+\/([^?]+)/);
  if (match && match[1] && match[1].length > 0) return null; // already has db

  // Try to list databases
  try {
    const adminDb = mongoose.connection.db!.admin();
    const result = await adminDb.listDatabases();
    const dbs = result.databases
      .map((d: any) => d.name)
      .filter((n: string) => !['admin', 'local', 'config'].includes(n));

    if (dbs.length === 1) return dbs[0];
    if (dbs.length > 1) {
      console.log('\n🔍 พบ database หลายตัว:');
      dbs.forEach((d: string, i: number) => console.log(`   ${i + 1}. ${d}`));
      console.log('\n💡 เพิ่มชื่อ database ต่อท้าย URI: .../DATABASE_NAME');
      return null;
    }
  } catch {
    // no admin access
  }
  return null;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ ตั้งค่า MONGODB_URI ก่อน:');
    console.error('   MONGODB_URI="mongodb+srv://user:pass@host/DBNAME" npx ts-node src/scripts/analyze-employees.ts');
    process.exit(1);
  }

  console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
    console.log(`✅ เชื่อมต่อสำเร็จ → ${mongoose.connection.host}`);
  } catch (err: any) {
    console.error('❌ เชื่อมต่อไม่ได้:', err.message);
    process.exit(1);
  }

  // Detect DB if not specified
  const detectedDb = await detectDatabase(uri);
  if (detectedDb) {
    console.log(`\n⚠️  ไม่ระบุ database ใน URI — ลอง switch ไปที่ "${detectedDb}"...`);
    await mongoose.disconnect();
    const uriWithDb = uri.replace(/\/$/, '') + `/${detectedDb}`;
    await mongoose.connect(uriWithDb, { serverSelectionTimeoutMS: 15000 });
  }

  const TARGET_CODES = ['SML005', 'SML007'];

  // 1. Fetch target employees
  const employees = await Employee.find({ employeeCode: { $in: TARGET_CODES } }).lean();

  if (employees.length === 0) {
    console.error(`\n❌ ไม่พบพนักงาน ${TARGET_CODES.join(', ')}`);
    const allEmps = await Employee.find({}, { employeeCode: 1, name: 1 }).lean();
    if (allEmps.length > 0) {
      console.log('พนักงานใน DB:', allEmps.map((e: any) => `${e.employeeCode} (${e.name})`).join(', '));
    } else {
      console.log('ไม่มีข้อมูลพนักงานใน collection employees เลย — อาจเป็น database ผิด');
    }
    await mongoose.disconnect();
    process.exit(1);
  }

  const empIds = employees.map((e: any) => e._id);

  // 2. Message stats per employee
  const msgAgg = await Message.aggregate([
    { $match: { employeeId: { $in: empIds }, senderType: 'employee' } },
    {
      $group: {
        _id: '$employeeId',
        messageCount: { $sum: 1 },
        avgResponseGapMs: { $avg: '$responseGapMs' },
        maxResponseGapMs: { $max: '$responseGapMs' },
        firstMsgAt: { $min: '$timestamp' },
        lastMsgAt: { $max: '$timestamp' },
      },
    },
  ]);

  // 3. Conversation stats per employee
  const convAgg = await Conversation.aggregate([
    { $match: { participantEmployeeIds: { $elemMatch: { $in: empIds } } } },
    { $unwind: '$participantEmployeeIds' },
    { $match: { participantEmployeeIds: { $in: empIds } } },
    {
      $group: {
        _id: '$participantEmployeeIds',
        conversationCount: { $sum: 1 },
        avgFirstResponseMs: { $avg: '$firstResponseMs' },
        convosWithResponse: {
          $sum: { $cond: [{ $gt: ['$firstResponseMs', 0] }, 1, 0] },
        },
        fastConvos: {
          $sum: {
            $cond: [
              { $and: [{ $gt: ['$firstResponseMs', 0] }, { $lte: ['$firstResponseMs', 900000] }] },
              1,
              0,
            ],
          },
        },
        categories: { $push: '$issueCategory' },
      },
    },
  ]);

  const msgMap = new Map(msgAgg.map((s: any) => [s._id.toString(), s]));
  const convMap = new Map(convAgg.map((s: any) => [s._id.toString(), s]));

  // ─── Print report ───────────────────────────────────────────────────────────
  const W = 62;
  const LINE = '─'.repeat(W);
  const DLINE = '═'.repeat(W);

  console.log('\n╔' + '═'.repeat(W) + '╗');
  console.log('║' + center('3-MONTH PERFORMANCE REVIEW', W) + '║');
  console.log('║' + center('SML005 & SML007 | ข้อมูลทั้งหมดใน DB', W) + '║');
  console.log('║' + center(`วันที่ประเมิน: ${new Date().toLocaleDateString('th-TH')}`, W) + '║');
  console.log('╚' + '═'.repeat(W) + '╝\n');

  const sorted = [...employees].sort((a: any, b: any) =>
    a.employeeCode.localeCompare(b.employeeCode)
  );

  for (const emp of sorted) {
    const id = (emp as any)._id.toString();
    const msg = msgMap.get(id);
    const conv = convMap.get(id);

    // Working period
    let daysWorked = 0;
    let msgsPerDay = 0;
    let dateRange = 'ไม่มีข้อมูล';
    if (msg?.firstMsgAt && msg?.lastMsgAt) {
      const first = new Date(msg.firstMsgAt);
      const last = new Date(msg.lastMsgAt);
      daysWorked = Math.max(1, Math.ceil((last.getTime() - first.getTime()) / 86400000));
      msgsPerDay = (msg.messageCount || 0) / daysWorked;
      dateRange = `${first.toLocaleDateString('th-TH')} → ${last.toLocaleDateString('th-TH')}`;
    }

    // Fast response %
    const convCount = conv?.conversationCount || 0;
    const fastCount = conv?.fastConvos || 0;
    const fastPct = convCount > 0 ? (fastCount / convCount) * 100 : 0;

    // Top issue categories
    const catCounts = new Map<string, number>();
    if (conv?.categories) {
      for (const cat of conv.categories) {
        if (cat) catCounts.set(cat, (catCounts.get(cat) || 0) + 1);
      }
    }
    const topCats = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const badge = (emp as any).isActive ? '🟢 Active' : '🔴 Inactive';

    console.log(`[${(emp as any).employeeCode}] ${(emp as any).name}  ${badge}`);
    console.log(`ระยะเวลา: ${daysWorked} วัน  (${dateRange})`);
    console.log(LINE);

    console.log('📊 ปริมาณงาน (Volume)');
    console.log(`   ข้อความที่ส่ง   : ${fmtNum(msg?.messageCount || 0)} ข้อความ${daysWorked > 0 ? `  (เฉลี่ย ${msgsPerDay.toFixed(1)} ข้อความ/วัน)` : ''}`);
    console.log(`   บทสนทนา        : ${fmtNum(convCount)} sessions`);

    console.log('\n⚡ ความเร็วในการตอบ (Speed)');
    console.log(`   เฉลี่ย          : ${fmtMs(msg?.avgResponseGapMs)}`);
    console.log(`   ช้าที่สุด       : ${fmtMs(msg?.maxResponseGapMs)}`);
    const barStr = progressBar(fastPct);
    console.log(`   ตอบใน 15 นาที  : ${barStr} ${fastPct.toFixed(1)}%  (${fastCount}/${convCount} sessions)`);

    console.log('\n🏷  ประเภทปัญหาที่จัดการบ่อย (Top Issues)');
    if (topCats.length > 0) {
      topCats.forEach(([cat, count], i) => {
        const pct = convCount > 0 ? (count / convCount) * 100 : 0;
        console.log(`   ${i + 1}. ${cat.padEnd(32)} ${String(count).padStart(3)} cases  (${pct.toFixed(0)}%)`);
      });
    } else {
      console.log('   ไม่มีข้อมูล — AI ยังไม่ได้ categorize conversations');
    }

    console.log('\n' + DLINE + '\n');
  }

  // Summary
  const totalMsgs = msgAgg.reduce((s: number, m: any) => s + (m.messageCount || 0), 0);
  const totalConvs = convAgg.reduce((s: number, c: any) => s + (c.conversationCount || 0), 0);
  const validAvg = msgAgg.filter((m: any) => m.avgResponseGapMs > 0);
  const teamAvgMs =
    validAvg.length > 0
      ? validAvg.reduce((s: number, m: any) => s + m.avgResponseGapMs, 0) / validAvg.length
      : 0;

  console.log('📈 สรุปภาพรวมทั้งสองคน');
  console.log(`   ข้อความรวม        : ${fmtNum(totalMsgs)}`);
  console.log(`   บทสนทนารวม        : ${fmtNum(totalConvs)}`);
  console.log(`   เฉลี่ยเวลาตอบ     : ${fmtMs(teamAvgMs)}`);
  console.log();

  await mongoose.disconnect();
  console.log('✅ เสร็จสิ้น');
}

main().catch((err) => {
  console.error('ERROR:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
