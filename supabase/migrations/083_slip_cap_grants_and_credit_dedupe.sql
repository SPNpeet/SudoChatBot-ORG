-- 083: อุด 2 ช่องโหว่ที่พบจากการตรวจซ้ำ (5 ส.ค. 2569) — apply บน production แล้ว
--
-- (1) consume_platform_slip เปิดให้ anon เรียกได้ (วัดจริงบน production: has_function_privilege = true)
--     สาเหตุ: migration 082 สร้างฟังก์ชันแล้วลืม revoke ต่างจาก 017/020/043 ที่ revoke ทุกตัว
--     ผลถ้าไม่แก้: ใครก็ได้ (anon key อยู่ใน bundle ฝั่ง client) ยิง 100 ครั้งใน 2 วินาที
--     -> เพดานสลิปเต็มทั้งเดือน -> ระบบตรวจสลิปทั้งแพลตฟอร์มตายยาวจนถึงเดือนหน้า
--     ความ fail-closed ของ guard กลายเป็นอาวุธของผู้โจมตีเมื่อตัวจุดชนวนเปิดให้คนนอก
revoke execute on function public.consume_platform_slip() from public, anon, authenticated;

-- (2) ตาข่ายระดับฐานข้อมูลกันเครดิตเข้าซ้ำจากรายการเติมเงินใบเดียว
--     credit_wallet ไม่ idempotent และเส้น topup-slip เป็น check-then-act (อ่านสถานะ -> ตัดสินใจ -> เขียน)
--     ต่อให้แก้โค้ดให้ atomic แล้ว ก็ควรมีตาข่ายที่ทำให้ "เครดิตซ้ำ" เป็นไปไม่ได้เชิงโครงสร้าง
--     ไม่ใช่แค่ "ไม่น่าเกิด" — เงินของลูกค้าต้องกันด้วยข้อจำกัดของฐานข้อมูล ไม่ใช่ด้วยลำดับโค้ด
--     วัดแล้วก่อนสร้าง: ไม่มีข้อมูลซ้ำเดิมเลย จึงสร้างได้ทันทีโดยไม่กระทบของเก่า
create unique index if not exists wallet_tx_topup_once
  on wallet_transactions (ref_id)
  where ref_type = 'topup' and ref_id is not null;
