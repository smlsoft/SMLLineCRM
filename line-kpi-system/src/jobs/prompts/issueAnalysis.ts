import { IssueAnalysisParams } from '../../services/ai/AiAdapter';

export function buildIssueAnalysisPrompt(params: IssueAnalysisParams): string {
  const { groupName, date, messageLog, previousCategories } = params;
  const prevList = previousCategories.length > 0
    ? previousCategories.map((c) => `- ${c}`).join('\n')
    : '(ไม่มีข้อมูลก่อนหน้า)';

  return `คุณคือผู้เชี่ยวชาญวิเคราะห์ปัญหาลูกค้าจากบทสนทนา customer support ภาษาไทย

กลุ่ม: ${groupName}
วันที่: ${date}

หมวดหมู่ปัญหาที่เคยพบใน 7 วันก่อนหน้า (ใช้เปรียบเทียบ recurring/emerging):
${prevList}

บทสนทนาวันนี้ (รูปแบบ: [เวลา] [ลูกค้า/พนักงาน]: ข้อความ):
---
${messageLog}
---

วิเคราะห์และตอบในรูปแบบ JSON ต่อไปนี้เท่านั้น ไม่ต้องมีข้อความอื่น:
{
  "issueCategories": [
    {
      "category": "ชื่อหมวดหมู่ปัญหา (สั้นกระชับ ไม่เกิน 5 คำ)",
      "count": 3,
      "percentage": 30,
      "examples": ["ตัวอย่างข้อความลูกค้า 1", "ตัวอย่างข้อความลูกค้า 2"],
      "trend": "new"
    }
  ],
  "recurringIssues": ["ปัญหาที่เจอซ้ำจากสัปดาห์ก่อน 1", "ปัญหาที่เจอซ้ำ 2"],
  "emergingIssues": ["ปัญหาใหม่ที่เพิ่งปรากฏวันนี้ 1"],
  "rootCauseInsight": "วิเคราะห์สาเหตุที่แท้จริงที่ทำให้ลูกค้ามีปัญหาเหล่านี้ 2-3 ประโยค",
  "recommendedActions": ["แนะนำสิ่งที่ธุรกิจควรทำเพื่อแก้ไขปัญหา 1", "แนะนำ 2", "แนะนำ 3"]
}

กฎ:
- issueCategories: ระบุ 3-7 หมวดหมู่ เรียงจากมากไปน้อย percentage รวมได้ 100
- trend: 'new'=ปัญหาใหม่ไม่เคยเจอ, 'up'=เพิ่มขึ้น, 'down'=ลดลง, 'stable'=เท่าเดิม (เทียบกับ previousCategories)
- recurringIssues: ปัญหาที่ชื่อใกล้เคียงกับ previousCategories (คัดลอกชื่อ category จาก issueCategories)
- emergingIssues: ปัญหาที่ trend='new' (คัดลอกชื่อ category จาก issueCategories)
- examples ต่อ category สูงสุด 3 ข้อความ ความยาวไม่เกิน 50 ตัวอักษร`;
}
