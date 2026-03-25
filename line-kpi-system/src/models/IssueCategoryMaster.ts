import { Schema, model, Document } from 'mongoose';

export interface IIssueCategoryMaster extends Document {
  name: string;
  description?: string;
  keywords: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const issueCategoryMasterSchema = new Schema<IIssueCategoryMaster>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String },
    keywords: [{ type: String }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const IssueCategoryMaster = model<IIssueCategoryMaster>(
  'IssueCategoryMaster',
  issueCategoryMasterSchema
);

export const SEED_CATEGORIES = [
  { name: 'เข้าโปรแกรมไม่ได้', description: 'ปัญหาเกี่ยวกับการเข้าสู่ระบบหรือเปิดโปรแกรมไม่ได้', keywords: ['login', 'เข้าไม่ได้', 'เปิดไม่ได้', 'รหัสผ่าน'] },
  { name: 'ถามเกี่ยวกับต้นทุน/ราคา', description: 'คำถามเกี่ยวกับต้นทุนสินค้า ราคาขาย หรือการคำนวณกำไร', keywords: ['ต้นทุน', 'ราคา', 'กำไร', 'cost'] },
  { name: 'ติดตั้ง Server ใหม่', description: 'การติดตั้งหรือย้าย server ใหม่', keywords: ['ติดตั้ง', 'server', 'install', 'ย้าย'] },
  { name: 'ปัญหาการพิมพ์/รายงาน', description: 'ปัญหาเกี่ยวกับการพิมพ์เอกสารหรือออกรายงาน', keywords: ['พิมพ์', 'print', 'รายงาน', 'report'] },
  { name: 'ปัญหาการคำนวณตัวเลข', description: 'ตัวเลขคำนวณผิด ยอดไม่ตรง', keywords: ['คำนวณ', 'ยอด', 'ผิด', 'ไม่ตรง'] },
  { name: 'ข้อมูลผิดพลาด/สูญหาย', description: 'ข้อมูลหาย ถูกลบ หรือแสดงผลผิดพลาด', keywords: ['ข้อมูลหาย', 'ลบ', 'ผิดพลาด', 'data'] },
  { name: 'ปัญหาการเชื่อมต่อ/เครือข่าย', description: 'ปัญหาเน็ตเวิร์ก การเชื่อมต่อระหว่างเครื่อง', keywords: ['เน็ต', 'network', 'เชื่อมต่อ', 'connection'] },
  { name: 'อัปเดต/อัปเกรดโปรแกรม', description: 'การอัปเดตเวอร์ชันโปรแกรมหรือ patch', keywords: ['update', 'upgrade', 'อัปเดต', 'version'] },
  { name: 'ถามวิธีใช้งาน', description: 'ขอคำแนะนำวิธีใช้งานฟีเจอร์ต่างๆ', keywords: ['วิธี', 'ทำยังไง', 'how to', 'ใช้งาน'] },
  { name: 'ปัญหา License/สิทธิ์การใช้งาน', description: 'ปัญหาเกี่ยวกับ license หมดอายุหรือสิทธิ์ไม่เพียงพอ', keywords: ['license', 'สิทธิ์', 'หมดอายุ', 'expire'] },
];

export async function seedIssueCategoryMaster(): Promise<void> {
  const count = await IssueCategoryMaster.countDocuments();
  if (count > 0) return;

  await IssueCategoryMaster.insertMany(
    SEED_CATEGORIES.map((c) => ({ ...c, isActive: true }))
  );
  console.log('[IssueCategoryMaster] Seeded', SEED_CATEGORIES.length, 'default categories');
}
