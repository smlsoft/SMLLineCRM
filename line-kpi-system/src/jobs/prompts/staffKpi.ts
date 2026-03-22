import { StaffKpiParams } from '../../services/ai/AiAdapter';

export function buildStaffKpiPrompt(params: StaffKpiParams): string {
  const { employeeName, date, rawMetrics, sampleMessages } = params;

  const avgResp = rawMetrics.avgResponseMs
    ? `${Math.round(rawMetrics.avgResponseMs / 60000)} นาที`
    : 'ไม่มีข้อมูล';
  const maxResp = rawMetrics.maxResponseMs
    ? `${Math.round(rawMetrics.maxResponseMs / 60000)} นาที`
    : 'ไม่มีข้อมูล';
  const firstRate = rawMetrics.firstResponseRate !== undefined
    ? `${Math.round(rawMetrics.firstResponseRate * 100)}%`
    : 'ไม่มีข้อมูล';

  return `คุณคือผู้จัดการ HR ที่ประเมินประสิทธิภาพพนักงาน customer support ภาษาไทย

พนักงาน: ${employeeName}
วันที่: ${date}

ข้อมูลเชิงตัวเลข:
- จำนวนบทสนทนาที่ดูแล: ${rawMetrics.conversationsHandled} กลุ่ม
- จำนวนข้อความที่ตอบ: ${rawMetrics.messagesSent} ข้อความ
- เวลาตอบกลับเฉลี่ย: ${avgResp}
- เวลาตอบกลับนานที่สุด: ${maxResp}
- อัตราการตอบกลับใน 5 นาที: ${firstRate}

ตัวอย่างการตอบกลับของพนักงาน (สุ่มมา ไม่เกิน 20 ข้อความ):
---
${sampleMessages || '(ไม่มีข้อมูลตัวอย่าง)'}
---

กรุณาประเมินและตอบในรูปแบบ JSON เท่านั้น ไม่ต้องมีข้อความอื่น:
{
  "qualityScore": 7,
  "kpiNarrative": "สรุปการทำงานของพนักงานคนนี้วันนี้ 2-4 ประโยค ครอบคลุมปริมาณงาน คุณภาพการตอบ และความรวดเร็ว",
  "strengths": ["จุดเด่น 1", "จุดเด่น 2"],
  "areasToImprove": ["สิ่งที่ควรปรับปรุง 1", "สิ่งที่ควรปรับปรุง 2"]
}

โดย qualityScore: 1-4=ต่ำกว่ามาตรฐาน, 5-6=พอใช้, 7-8=ดี, 9-10=ดีเยี่ยม
strengths และ areasToImprove: ระบุ 1-3 ข้อ ข้อละไม่เกิน 15 คำ`;
}
