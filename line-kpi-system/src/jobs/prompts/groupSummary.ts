import { GroupSummaryParams } from '../../services/ai/AiAdapter';

export function buildGroupSummaryPrompt(params: GroupSummaryParams): string {
  const { groupName, date, messageLog, rawMetrics } = params;
  const avgFirst = rawMetrics.avgFirstResponseMs
    ? `${Math.round(rawMetrics.avgFirstResponseMs / 60000)} นาที`
    : 'ไม่มีข้อมูล';
  const avgResp = rawMetrics.avgResponseMs
    ? `${Math.round(rawMetrics.avgResponseMs / 60000)} นาที`
    : 'ไม่มีข้อมูล';

  return `คุณคือผู้เชี่ยวชาญการวิเคราะห์ข้อมูล customer support ภาษาไทย

กลุ่ม: ${groupName}
วันที่: ${date}
จำนวนบทสนทนา: ${rawMetrics.totalConversations} กลุ่ม
จำนวนข้อความทั้งหมด: ${rawMetrics.totalMessages} ข้อความ
เวลาตอบกลับครั้งแรกเฉลี่ย: ${avgFirst}
เวลาตอบกลับเฉลี่ย: ${avgResp}

บทสนทนาวันนี้ (รูปแบบ: [เวลา] [ลูกค้า/พนักงาน]: ข้อความ):
---
${messageLog}
---

กรุณาวิเคราะห์และตอบในรูปแบบ JSON ต่อไปนี้เท่านั้น ไม่ต้องมีข้อความอื่น:
{
  "summaryText": "สรุปภาพรวมบทสนทนาวันนี้ในกลุ่มนี้ 3-5 ประโยค ครอบคลุมปัญหาหลัก แนวทางแก้ไข และบรรยากาศโดยรวม",
  "topIssues": ["ปัญหาที่พบ 1", "ปัญหาที่พบ 2", "ปัญหาที่พบ 3"],
  "sentimentScore": 3
}

โดย sentimentScore: 1=ลูกค้าไม่พอใจมาก, 2=ไม่พอใจ, 3=กลางๆ, 4=พอใจ, 5=พอใจมาก
topIssues ให้ระบุ 3-5 หัวข้อสั้นๆ ไม่เกิน 10 คำต่อหัวข้อ`;
}

export function buildGroupSummaryFromThreadsPrompt(
  groupName: string,
  date: string,
  threadSummaries: string[]
): string {
  const combined = threadSummaries.map((s, i) => `Thread ${i + 1}: ${s}`).join('\n');
  return `คุณคือผู้เชี่ยวชาญการวิเคราะห์ข้อมูล customer support ภาษาไทย

กลุ่ม: ${groupName}
วันที่: ${date}

นี่คือสรุปแต่ละบทสนทนาในวันนี้:
---
${combined}
---

กรุณาสรุปภาพรวมทั้งวันในรูปแบบ JSON เท่านั้น:
{
  "summaryText": "สรุปภาพรวมทั้งวัน 3-5 ประโยค",
  "topIssues": ["ปัญหาที่พบ 1", "ปัญหาที่พบ 2", "ปัญหาที่พบ 3"],
  "sentimentScore": 3
}`;
}
