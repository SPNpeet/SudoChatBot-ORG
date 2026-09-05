// ============================================================
//  แปล error ให้เป็นภาษาคน — ที่เดียวของทั้งระบบ (5 ก.ย. 2569)
//
//  ทำไม: เคยมี friendly() สองก๊อบปี้ (dashboard/actions.ts · finance/actions.ts) ที่แปลแค่คำว่า
//  "forbidden" แล้วปล่อยข้อความดิบที่เหลือถึงผู้ใช้ และอีก 30+ จุดคืน error.message ตรง ๆ
//  ผลจริง: ลูกค้าเห็น `duplicate key value violates unique constraint "products_shop_id_sku_key"`
//  บน toast — อ่านไม่ออกและทำให้รู้สึกว่าระบบพัง ทั้งที่แค่กรอกรหัสสินค้าซ้ำ
//
//  กติกา: ข้อความภาษาไทย = ของเราเขียนให้คนอ่าน ให้ผ่าน · ข้อความอังกฤษ/SQL = แปลตามรายการ
//  ที่รู้จัก นอกนั้นใช้ fallback ของจุดเรียก (ห้ามปล่อยอังกฤษดิบหลุด)
// ============================================================
export function friendlyError(e: unknown, fallback: string): string {
  const raw = typeof e === "string" ? e : String((e as { message?: string } | null)?.message ?? "");
  if (/[\u0E00-\u0E7F]/.test(raw)) return raw;
  const m = raw.toLowerCase();
  if (m.includes("forbidden")) return "คุณไม่มีสิทธิ์ทำรายการนี้ในกิจการนี้ — แจ้งเจ้าของหรือผู้ดูแลให้ทำแทน";
  if (m.includes("duplicate key") || m.includes("23505") || m.includes("already exists")) return "มีรายการนี้อยู่แล้ว (ข้อมูลซ้ำ) — ตรวจชื่อหรือรหัสที่กรอกอีกครั้ง";
  if (m.includes("violates foreign key")) return "รายการนี้ยังถูกอ้างอิงจากข้อมูลอื่นอยู่ จึงลบหรือแก้ไม่ได้";
  if (m.includes("row-level security") || m.includes("permission denied") || m.includes("not authorized") || m.includes("jwt")) return "คุณไม่มีสิทธิ์ทำรายการนี้ หรือหมดเวลาเข้าระบบ — ลองเข้าระบบใหม่";
  if (m.includes("fetch failed") || m.includes("network") || m.includes("econn") || m.includes("timeout") || m.includes("timed out")) return "เชื่อมต่อไม่สำเร็จ — ข้อมูลที่กรอกยังอยู่ ลองอีกครั้ง";
  if (m.includes("too many requests") || m.includes("rate limit")) return "ทำรายการถี่เกินไป — รอสักครู่แล้วลองใหม่";
  return fallback;
}
