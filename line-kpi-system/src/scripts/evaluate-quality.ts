/**
 * Employee Quality Evaluation Script
 * ไล่อ่านบทสนทนาทีละ group เหมือน DailyAnalysisJob แล้วให้ Gemini ประเมินคุณภาพ
 *
 * รัน:
 *   MONGODB_URI="..." GEMINI_API_KEY="AIza..." \
 *     npx ts-node src/scripts/evaluate-quality.ts
 *
 * เปลี่ยน model:
 *   GEMINI_MODEL="gemini-1.5-flash" MONGODB_URI="..." GEMINI_API_KEY="..." ...
 */
import mongoose, { Types } from 'mongoose';
import axios from 'axios';

// ─── Model: เปลี่ยนได้ผ่าน env ───────────────────────────────────────────────
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const BATCH_SIZE = 4; // conversations ต่อ 1 API call

// ─── Schemas ─────────────────────────────────────────────────────────────────

const EmployeeSchema = new mongoose.Schema(
  { employeeCode: String, name: String, isActive: Boolean },
  { collection: 'employees' }
);

const CustomerGroupSchema = new mongoose.Schema(
  { name: String, lineGroupId: String },
  { collection: 'customergroups' }
);

const ConversationSchema = new mongoose.Schema(
  {
    customerGroupId: mongoose.Schema.Types.ObjectId,
    participantEmployeeIds: [mongoose.Schema.Types.ObjectId],
    firstResponseMs: Number,
    avgResponseMs: Number,
    maxResponseMs: Number,
    issueCategory: String,
    issueSummary: String,
    date: Date,
    startedAt: Date,
    lastMessageAt: Date,
    employeeMessageCount: Number,
    transcript: [
      {
        senderDisplayName: String,
        senderType: String,
        messageType: String,
        textContent: String,
        timestamp: Date,
      },
    ],
  },
  { collection: 'conversations' }
);

const MessageSchema = new mongoose.Schema(
  {
    conversationId: mongoose.Schema.Types.ObjectId,
    senderType: String,
    senderDisplayName: String,
    messageType: String,
    textContent: String,
    timestamp: Date,
    responseGapMs: Number,
    employeeId: mongoose.Schema.Types.ObjectId,
  },
  { collection: 'messages' }
);

const Employee = mongoose.model('Employee', EmployeeSchema);
const CustomerGroup = mongoose.model('CustomerGroup', CustomerGroupSchema);
const Conversation = mongoose.model('Conversation', ConversationSchema);
const Message = mongoose.model('Message', MessageSchema);

// ─── Types ────────────────────────────────────────────────────────────────────

interface ConvEval {
  convId: string;
  groupName: string;
  date: string;
  category: string;
  firstResponseMs: number;
  politeness: number;
  completeness: number;
  resolution: number;
  clarity: number;
  overall: number;
  summary: string;
  strength: string;
  weakness: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMs(ms: number | null | undefined): string {
  if (!ms || ms <= 0) return 'N/A';
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs} วินาที`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins} นาที ${remSecs > 0 ? `${remSecs} วินาที` : ''}`.trim();
  return `${Math.floor(mins / 60)} ชม. ${mins % 60} นาที`;
}

function scoreBar(score: number): string {
  const full = Math.round(score);
  return '★'.repeat(full) + '☆'.repeat(Math.max(0, 5 - full)) + ` ${score.toFixed(2)}/5`;
}

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Build transcript ─────────────────────────────────────────────────────────

async function buildTranscript(conv: any): Promise<string> {
  // ใช้ transcript ที่บันทึกไว้แล้ว (pattern เดียวกับ DailyAnalysisJob)
  if (conv.transcript && conv.transcript.length > 0) {
    const lines = (conv.transcript as any[])
      .filter((t) => t.textContent)
      .map((t) => `[${t.senderDisplayName}] ${t.textContent}`);
    if (lines.length >= 2) return lines.join('\n');
  }

  // Fallback: ดึงจาก messages collection
  const msgs = await Message.find(
    { conversationId: conv._id },
    { senderDisplayName: 1, senderType: 1, messageType: 1, textContent: 1, timestamp: 1 }
  )
    .sort({ timestamp: 1 })
    .lean();

  return (msgs as any[])
    .filter((m) => m.textContent)
    .map((m) => `[${m.senderDisplayName}] ${m.textContent}`)
    .join('\n');
}

// ─── Gemini API: ประเมิน batch ────────────────────────────────────────────────

interface BatchConvInput {
  id: string;
  transcript: string;
  category: string;
}

interface BatchConvResult {
  id: string;
  politeness: number;
  completeness: number;
  resolution: number;
  clarity: number;
  overall: number;
  summary: string;
  strength: string;
  weakness: string;
}

async function evaluateBatch(
  items: BatchConvInput[],
  employeeName: string,
  apiKey: string
): Promise<BatchConvResult[]> {
  const convBlocks = items
    .map(
      (item, i) =>
        `=== บทสนทนา #${i + 1} [ID: ${item.id}] ประเภทปัญหา: ${item.category} ===\n${item.transcript}`
    )
    .join('\n\n');

  const prompt = `คุณคือผู้เชี่ยวชาญด้าน Customer Support Quality Assurance
ประเมินคุณภาพการทำงานของพนักงาน "${employeeName}" จากบทสนทนาต่อไปนี้

ให้คะแนน 1-5 ต่อบทสนทนา (1=แย่มาก, 3=พอใช้, 5=ดีเยี่ยม)

${convBlocks}

ตอบกลับเป็น JSON array เท่านั้น (ไม่มีข้อความอื่น):
[
  {
    "id": "<ID ของบทสนทนา>",
    "politeness": <1-5>,
    "completeness": <1-5>,
    "resolution": <1-5>,
    "clarity": <1-5>,
    "overall": <1-5>,
    "summary": "<สรุปบทสนทนา 1 ประโยค>",
    "strength": "<จุดเด่นของพนักงาน>",
    "weakness": "<สิ่งที่ควรปรับปรุง หรือ ไม่มี>"
  }
]`;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 2048, temperature: 0.1 },
        },
        { headers: { 'content-type': 'application/json' }, timeout: 60000 }
      );

      const text: string = res.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        process.stdout.write(`\n      [parse error] ไม่พบ JSON array: ${cleaned.slice(0, 100)}\n`);
        return [];
      }
      return JSON.parse(jsonMatch[0]) as BatchConvResult[];
    } catch (err: any) {
      const status = err?.response?.status;
      const msg: string = err?.response?.data?.error?.message || err?.message || 'unknown';

      if (status === 429) {
        // Parse retry delay from message: "Please retry in X.XXXs."
        const retryMatch = msg.match(/retry in (\d+\.?\d*)\s*s/i);
        const waitSec = retryMatch ? Math.ceil(parseFloat(retryMatch[1])) + 2 : 60;
        process.stdout.write(`\n      [429 rate limit] รอ ${waitSec} วินาที...`);
        await sleep(waitSec * 1000);
        continue; // retry
      }

      process.stdout.write(`\n      [api error ${status}] ${msg.slice(0, 120)}\n`);
      return [];
    }
  }
  return [];
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!mongoUri) {
    console.error('❌ ต้องตั้งค่า MONGODB_URI');
    process.exit(1);
  }
  if (!apiKey) {
    console.error('❌ ต้องตั้งค่า GEMINI_API_KEY (รับได้ที่ https://aistudio.google.com/app/apikey)');
    process.exit(1);
  }

  console.log('🔌 กำลังเชื่อมต่อ MongoDB...');
  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 15000 });
  console.log(`✅ เชื่อมต่อสำเร็จ  (model: ${GEMINI_MODEL})\n`);

  const TARGET_CODES = ['SML005', 'SML007'];
  const employees = await Employee.find({ employeeCode: { $in: TARGET_CODES } }).lean() as any[];

  if (employees.length === 0) {
    console.error('❌ ไม่พบพนักงาน SML005/SML007');
    await mongoose.disconnect();
    process.exit(1);
  }

  // ─── ไล่ทีละพนักงาน ──────────────────────────────────────────────────────
  const allResults = new Map<string, { emp: any; evals: ConvEval[] }>();

  for (const emp of employees.sort((a, b) => a.employeeCode.localeCompare(b.employeeCode))) {
    const empId = emp._id as Types.ObjectId;
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`👤 [${emp.employeeCode}] ${emp.name}`);
    console.log('═'.repeat(60));

    // หา groups ที่พนักงานคนนี้มีส่วนร่วม
    const groupIds = await Conversation.distinct('customerGroupId', {
      participantEmployeeIds: empId,
    });

    console.log(`   พบ ${groupIds.length} กลุ่มที่เคยทำงาน\n`);

    const empEvals: ConvEval[] = [];

    // ─── ไล่ทีละ group (เหมือน DailyAnalysisJob) ─────────────────────────
    for (const groupId of groupIds) {
      const group = await CustomerGroup.findById(groupId).lean() as any;
      const groupName = group?.name ?? String(groupId);

      // โหลด conversations ของพนักงานคนนี้ในกลุ่มนี้ (ทุก record)
      const convs = await Conversation.find(
        { customerGroupId: groupId, participantEmployeeIds: empId },
        {
          _id: 1, issueCategory: 1, firstResponseMs: 1,
          avgResponseMs: 1, transcript: 1, date: 1,
          startedAt: 1, lastMessageAt: 1,
        }
      ).sort({ date: -1 }).lean() as any[];

      if (convs.length === 0) continue;

      process.stdout.write(`   📂 กลุ่ม "${groupName}" (${convs.length} บทสนทนา)... `);

      // Build transcripts ทั้ง group ก่อน
      const batchInputs: BatchConvInput[] = [];
      for (const conv of convs) {
        const transcript = await buildTranscript(conv);
        if (!transcript || transcript.split('\n').length < 2) continue;
        batchInputs.push({
          id: conv._id.toString(),
          transcript: transcript.slice(0, 2000), // cap per conversation
          category: conv.issueCategory || 'ไม่ระบุ',
        });
      }

      if (batchInputs.length === 0) {
        process.stdout.write('ไม่มีเนื้อหาข้อความ\n');
        continue;
      }

      // ส่ง Gemini เป็น batch (BATCH_SIZE conversations ต่อ call)
      const convMap = new Map(convs.map((c: any) => [c._id.toString(), c]));
      let groupEvalCount = 0;

      for (let i = 0; i < batchInputs.length; i += BATCH_SIZE) {
        const chunk = batchInputs.slice(i, i + BATCH_SIZE);
        process.stdout.write(`🤖 (${i + 1}-${Math.min(i + BATCH_SIZE, batchInputs.length)}/${batchInputs.length})... `);

        const results = await evaluateBatch(chunk, emp.name, apiKey);

        for (const r of results) {
          const conv = convMap.get(r.id);
          if (!conv) continue;
          empEvals.push({
            convId: r.id,
            groupName,
            date: new Date(conv.date).toLocaleDateString('th-TH'),
            category: conv.issueCategory || 'ไม่ระบุ',
            firstResponseMs: conv.firstResponseMs || 0,
            politeness: r.politeness,
            completeness: r.completeness,
            resolution: r.resolution,
            clarity: r.clarity,
            overall: r.overall,
            summary: r.summary,
            strength: r.strength,
            weakness: r.weakness,
          });
          groupEvalCount++;
        }

        // หยุดระหว่าง batch เพื่อไม่โดน rate limit (free tier ~5 RPM)
        if (i + BATCH_SIZE < batchInputs.length) await sleep(13000);
      }

      process.stdout.write(`✓ ประเมินได้ ${groupEvalCount}/${batchInputs.length}\n`);

      // หยุดระหว่าง group
      if (groupIds.indexOf(groupId) < groupIds.length - 1) await sleep(5000);
    }

    allResults.set(emp.employeeCode, { emp, evals: empEvals });
    console.log(`\n   ✅ รวม ${empEvals.length} บทสนทนาที่ประเมินสำเร็จ`);
  }

  // ─── พิมพ์รายงาน ─────────────────────────────────────────────────────────
  const W = 64;
  console.log('\n\n╔' + '═'.repeat(W) + '╗');
  console.log('║' + ' QUALITY EVALUATION REPORT — AI-POWERED '.padStart((W + 42) / 2).padEnd(W) + '║');
  console.log('║' + ` ประเมินโดย Gemini (${GEMINI_MODEL})`.padEnd(W) + '║');
  console.log('╚' + '═'.repeat(W) + '╝');

  for (const code of TARGET_CODES) {
    const data = allResults.get(code);
    if (!data || data.evals.length === 0) {
      console.log(`\n[${code}] ไม่มีข้อมูลเพียงพอสำหรับประเมิน\n`);
      continue;
    }

    const { emp, evals } = data;

    const avgPoliteness   = avg(evals.map((e) => e.politeness));
    const avgCompleteness = avg(evals.map((e) => e.completeness));
    const avgResolution   = avg(evals.map((e) => e.resolution));
    const avgClarity      = avg(evals.map((e) => e.clarity));
    const avgOverall      = avg(evals.map((e) => e.overall));

    const grade =
      avgOverall >= 4.5 ? 'A  (ดีเยี่ยม)' :
      avgOverall >= 4.0 ? 'B+ (ดีมาก)' :
      avgOverall >= 3.5 ? 'B  (ดี)' :
      avgOverall >= 3.0 ? 'C+ (พอใช้)' :
      avgOverall >= 2.5 ? 'C  (ต้องปรับปรุง)' : 'D  (ต่ำกว่าเกณฑ์)';

    const verdict =
      avgOverall >= 3.5 ? '✅ แนะนำให้ผ่านโปรบ' :
      avgOverall >= 2.5 ? '⚠️  ผ่านโปรบ พร้อมแผนพัฒนา' : '❌ ยังไม่ผ่านเกณฑ์คุณภาพ';

    // คุณภาพ vs ความเร็ว
    const fastEvals = evals.filter((e) => e.firstResponseMs > 0 && e.firstResponseMs <= 900000);
    const slowEvals = evals.filter((e) => e.firstResponseMs > 900000);

    // Category breakdown
    const catMap = new Map<string, number[]>();
    for (const e of evals) {
      if (!catMap.has(e.category)) catMap.set(e.category, []);
      catMap.get(e.category)!.push(e.overall);
    }

    // Top weaknesses
    const weaknesses = evals
      .map((e) => e.weakness)
      .filter((w) => w && w !== 'ไม่มี' && w.length > 2);

    console.log(`\n${'─'.repeat(W)}`);
    console.log(`[${emp.employeeCode}] ${emp.name}`);
    console.log(`ประเมินจาก ${evals.length} บทสนทนา  |  เกรด: ${grade}  |  ${verdict}`);
    console.log('─'.repeat(W));

    console.log('\n📊 คะแนนรายด้าน');
    console.log(`   ความสุภาพ/มารยาท     : ${scoreBar(avgPoliteness)}`);
    console.log(`   ตอบครบถ้วน           : ${scoreBar(avgCompleteness)}`);
    console.log(`   แก้ปัญหาได้จริง      : ${scoreBar(avgResolution)}`);
    console.log(`   ชัดเจน/เข้าใจง่าย    : ${scoreBar(avgClarity)}`);
    console.log(`   ภาพรวม               : ${scoreBar(avgOverall)}`);

    if (fastEvals.length > 0 || slowEvals.length > 0) {
      console.log('\n⚡ คุณภาพ vs ความเร็ว');
      if (fastEvals.length > 0)
        console.log(`   ตอบใน 15 นาที (${fastEvals.length} เคส) : overall ${scoreBar(avg(fastEvals.map((e) => e.overall)))}`);
      if (slowEvals.length > 0)
        console.log(`   ตอบ > 15 นาที  (${slowEvals.length} เคส) : overall ${scoreBar(avg(slowEvals.map((e) => e.overall)))}`);
    }

    if (catMap.size > 0) {
      console.log('\n🏷  คะแนนแยกตามประเภทปัญหา');
      Array.from(catMap.entries())
        .sort((a, b) => b[1].length - a[1].length)
        .forEach(([cat, scores]) => {
          console.log(`   ${cat.slice(0, 30).padEnd(30)} : ${scoreBar(avg(scores))} (${scores.length} เคส)`);
        });
    }

    if (weaknesses.length > 0) {
      console.log('\n🔧 จุดที่ควรพัฒนา (พบบ่อย)');
      weaknesses.slice(0, 4).forEach((w, i) => console.log(`   ${i + 1}. ${w}`));
    }

    const best  = [...evals].sort((a, b) => b.overall - a.overall)[0];
    const worst = [...evals].sort((a, b) => a.overall - b.overall)[0];

    console.log('\n📌 ตัวอย่าง');
    if (best) {
      console.log(`   🏆 ดีที่สุด (overall ${best.overall}/5) — ${best.groupName} วันที่ ${best.date}`);
      console.log(`      "${best.summary}"`);
    }
    if (worst && worst.overall < 4) {
      console.log(`   ⚠️  ต้องปรับ (overall ${worst.overall}/5) — ${worst.groupName} วันที่ ${worst.date}`);
      console.log(`      "${worst.summary}"`);
      if (worst.weakness && worst.weakness !== 'ไม่มี')
        console.log(`      ปัญหา: ${worst.weakness}`);
    }
  }

  // ─── เปรียบเทียบ ──────────────────────────────────────────────────────────
  const d005 = allResults.get('SML005');
  const d007 = allResults.get('SML007');

  if (d005?.evals.length && d007?.evals.length) {
    const e005 = d005.evals;
    const e007 = d007.evals;

    console.log(`\n${'═'.repeat(W)}`);
    console.log('📋 เปรียบเทียบ SML005 vs SML007');
    console.log('─'.repeat(W));

    const dims: Array<[string, keyof ConvEval]> = [
      ['ความสุภาพ',     'politeness'],
      ['ตอบครบถ้วน',   'completeness'],
      ['แก้ปัญหาได้',  'resolution'],
      ['ชัดเจน',       'clarity'],
      ['ภาพรวม',       'overall'],
    ];

    console.log(`${'มิติ'.padEnd(20)} SML005 (${d005.emp.name.slice(0,8).padEnd(8)})   SML007 (${d007.emp.name.slice(0,8)})`);
    console.log('─'.repeat(W));

    for (const [label, key] of dims) {
      const v005 = avg(e005.map((e) => e[key] as number));
      const v007 = avg(e007.map((e) => e[key] as number));
      const diff = v005 - v007;
      const arrow = Math.abs(diff) < 0.1 ? '==' : diff > 0 ? '<-' : '->';
      console.log(`${label.padEnd(20)} ${v005.toFixed(2).padStart(5)}                ${v007.toFixed(2).padStart(5)}   ${arrow}`);
    }

    const a005 = avg(e005.map((e) => e.overall));
    const a007 = avg(e007.map((e) => e.overall));
    console.log('─'.repeat(W));

    const finalNote =
      Math.abs(a005 - a007) < 0.2 ? 'คะแนนใกล้เคียงกัน ทั้งสองควรผ่านโปรบ' :
      a005 > a007 ? `SML005 (${d005.emp.name}) คุณภาพสูงกว่า` :
      `SML007 (${d007.emp.name}) คุณภาพสูงกว่า`;

    console.log(`\n🏆 สรุป: ${finalNote}`);
    console.log(`   SML005: ${a005.toFixed(2)}/5  |  SML007: ${a007.toFixed(2)}/5`);
  }

  console.log(`\n${'═'.repeat(W)}\n`);
  await mongoose.disconnect();
  console.log('✅ เสร็จสิ้น');
}

main().catch((err) => {
  console.error('ERROR:', err?.message || err);
  mongoose.disconnect().finally(() => process.exit(1));
});
