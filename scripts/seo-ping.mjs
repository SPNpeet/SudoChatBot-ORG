// ============================================================
//  บอกเครื่องมือค้นหาว่าเรามีหน้าอะไรบ้าง โดยไม่ต้องใช้บัญชีเจ้าของ
//
//  ⚠️ Google ไม่รับ IndexNow ต้องใช้ Search Console เท่านั้น (งานของเจ้าของ)
//  แต่ Bing · Yandex · Seznam · Naver รับผ่าน IndexNow ทันที
//  สคริปต์นี้อ่าน sitemap.xml ของจริงแล้วส่งรายการ URL ไปให้
//
//  วิธีใช้:  npm run seo:ping
// ============================================================
const SITE = process.env.CHECK_BASE_URL || "https://sudochatbot.online";
const KEY = "9fb933781b84871b48722cefb88a92ec";

console.log("\n== บอกเครื่องมือค้นหาว่ามีหน้าอะไรบ้าง ==");

const keyUrl = `${SITE}/indexnow.txt`;
const keyRes = await fetch(keyUrl).catch(() => null);
const served = keyRes && keyRes.ok ? (await keyRes.text()).trim() : "";
if (served !== KEY) {
  console.log(`  หยุด — ${keyUrl} ยังไม่ตอบคีย์ที่ตรงกัน (ได้ "${served.slice(0, 12)}...")`);
  console.log("  แปลว่ายังไม่ได้ deploy หรือคีย์ในสคริปต์กับใน route ไม่ตรงกัน");
  process.exit(1);
}
console.log("  ถูก  ไฟล์คีย์บนโดเมนตรงกับสคริปต์");

const sm = await fetch(`${SITE}/sitemap.xml`).then((r) => r.text());
const urls = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urls.length) { console.log("  หยุด — อ่าน sitemap ไม่ได้"); process.exit(1); }
console.log(`  พบ ${urls.length} หน้าใน sitemap`);

const host = new URL(SITE).host;
const res = await fetch("https://api.indexnow.org/indexnow", {
  method: "POST",
  headers: { "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify({ host, key: KEY, keyLocation: keyUrl, urlList: urls }),
});
// 200 = รับแล้ว · 202 = รับแล้วรอตรวจคีย์ · 4xx = มีอะไรผิด
if (res.status === 200 || res.status === 202) {
  console.log(`  ถูก  ส่งให้ IndexNow แล้ว (${res.status}) — Bing · Yandex · Seznam · Naver จะตามมาเก็บเอง`);
  console.log("  ⚠️ Google ไม่ได้อยู่ในนี้ ต้องส่ง sitemap ผ่าน Search Console ด้วยบัญชีเจ้าของ");
} else {
  console.log(`  ผิด  IndexNow ตอบ ${res.status}: ${(await res.text()).slice(0, 200)}`);
  process.exit(1);
}
