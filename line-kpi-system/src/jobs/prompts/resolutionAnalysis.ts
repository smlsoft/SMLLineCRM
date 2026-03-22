export interface ResolutionAnalysisParams {
  groupName: string;
  date: string;
  messageLog: string; // last N messages of the conversation
  lastSenderType: 'employee' | 'customer';
}

export function buildResolutionAnalysisPrompt(params: ResolutionAnalysisParams): string {
  const { groupName, date, messageLog, lastSenderType } = params;
  const lastSenderLabel = lastSenderType === 'employee' ? 'พนักงาน' : 'ลูกค้า';

  return `คุณคือผู้ช่วยวิเคราะห์ customer support ภาษาไทย

กลุ่ม: ${groupName}
วันที่: ${date}
ข้อความล่าสุดในบทสนทนานี้มาจาก: ${lastSenderLabel}

บทสนทนา (รูปแบบ: [เวลา] [ลูกค้า/พนักงาน]: ข้อความ):
---
${messageLog}
---

จงวิเคราะห์ว่าปัญหาหรือคำถามของลูกค้าในบทสนทนานี้ได้รับการแก้ไขหรือตอบสนองอย่างสมบูรณ์แล้วหรือยัง

เกณฑ์การพิจารณา:
- "resolved" (จบแล้ว): ลูกค้าได้รับคำตอบหรือการช่วยเหลือที่เพียงพอแล้ว หรือลูกค้าแสดงความพอใจ หรือพนักงานตอบชัดเจนและลูกค้าไม่มีคำถามเพิ่ม
- "unresolved" (ยังไม่จบ): ลูกค้ายังรอคำตอบ หรือปัญหายังค้างอยู่ หรือมีคำถามที่ยังไม่ได้รับคำตอบ

ตอบในรูปแบบ JSON เท่านั้น:
{
  "resolution": "resolved",
  "reason": "เหตุผลสั้นๆ ไม่เกิน 1-2 ประโยค"
}`;
}
