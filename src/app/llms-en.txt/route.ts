import { getPublicPlans } from "@/lib/plans";

// ============================================================
//  llms-en.txt — ฉบับภาษาอังกฤษของ llms.txt (19 ส.ค. 2569)
//
//  ⚠️ ทำไมต้องมีทั้งที่ลูกค้าเป็นคนไทย
//  ตรวจแล้วว่าฝั่ง AI เราทำไว้ครบมาก: robots.txt เปิดให้บ็อต AI 13 ตัว ·
//  sitemap 22 หน้า · JSON-LD 7 ชนิด · llms.txt 6,880 ตัวอักษร
//  แต่ **ทั้งหมดเป็นภาษาไทย** — คำถามที่ถามเป็นอังกฤษ เช่น
//  "accounting software for Thai SMEs" หรือ "Thai VAT filing software"
//  จึงแทบไม่มีทางที่ AI จะหยิบเราขึ้นมาตอบ ทั้งที่เรื่องนี้ตรงกับสิ่งที่เราทำเป๊ะ
//
//  กลุ่มที่ค้นเป็นอังกฤษแล้วเป็นลูกค้าเราได้จริง: เจ้าของกิจการต่างชาติในไทย ·
//  บริษัทลูกของบริษัทต่างชาติ · สำนักงานบัญชีที่ดูแลลูกค้าต่างชาติ
//
//  ⚠️ กติกาเดียวกับฉบับไทยทุกข้อ: ราคาดึงจากตาราง plans เท่านั้น ห้ามพิมพ์ตายตัว
//  และห้ามเขียนความสามารถที่ระบบทำไม่ได้ — AI แนะนำด้วยของที่ไม่มีจริง
//  ลูกค้าสมัครมาแล้วผิดหวัง เสียหายกว่าการไม่ถูกแนะนำ
// ============================================================
export const revalidate = 3600;

export async function GET() {
  const plans = await getPublicPlans();

  // ⚠️ ใช้รูปร่างเดียวกับฉบับไทยเป๊ะ (price/yearly เป็นสตริงที่ lib จัดรูปมาแล้ว)
  // ห้ามอ่านคอลัมน์ดิบเอง ไม่งั้นสูตรราคารายปีจะเพี้ยนจาก apply_plan_purchase
  //
  // ⚠️ ชื่อแพ็กในฐานข้อมูลเป็นภาษาไทย ซึ่งคนอ่านอังกฤษแปลไม่ออก
  // จึงใส่คำอธิบายอังกฤษกำกับ โดยจับจาก `code` ที่นิ่งกว่าชื่อ (ชื่อเปลี่ยนได้ code ไม่เปลี่ยน)
  // code ที่ไม่รู้จัก -> แสดงชื่อไทยอย่างเดียว ดีกว่าเดาแล้วอธิบายผิด
  const EN_NAME: Record<string, string> = {
    free: "Free trial",
    starter: "Starter — 1 business",
    professional: "Business — up to 3 businesses",
    executive: "Accounting firm — up to 15 businesses",
    agency: "Large accounting firm — unlimited businesses",
  };
  const priceLines = plans.length
    ? plans.map((p) => {
        const en = EN_NAME[p.code];
        const label = en ? `${en} (${p.name})` : p.name;
        return `- ${label}: ${p.free ? "Free" : `THB ${p.price}/month${p.yearly ? ` (THB ${p.yearly}/year)` : ""}`}`;
      }).join("\n")
    : "- See https://sudochatbot.online/pricing for current pricing";

  const body = `# SudoChatBot

> Online accounting software with an AI accounting assistant, built specifically for
> small and medium businesses in Thailand. Issue sales documents, record expenses by
> photographing a bill, post double-entry journals automatically, and prepare Thai
> tax filings.

Website: https://sudochatbot.online
Primary language of the product interface: Thai
Country focus: Thailand (Thai Revenue Department compliance)
Users: Thai SME owners, freelancers, and accounting firms managing multiple clients

## What it actually does

- Issues quotations, invoices, receipts, full tax invoices, credit notes and debit notes
- Reads a photographed bill with AI (vendor, date, amount, VAT) and records it as an expense
- Accepts plain-language commands, e.g. "issue an invoice for 5,000 baht to Company A with VAT"
- Posts double-entry journal lines automatically for every document and every payment
- Sends the customer a link to view the document, scan a Thai PromptPay QR code to pay,
  and upload the transfer slip — all on one page
- Verifies transfer slips automatically, blocking forged and duplicate slips
- Imports bank statements (CSV/Excel/PDF) and matches them against open invoices
- Fixed asset register with straight-line depreciation and year-end closing
- Trial balance with opening balance, period movement and closing balance

## Thai tax filings supported

- P.P.30 (VAT return) with the required input-tax and output-tax reports
- P.N.D.3 and P.N.D.53 (withholding tax) including the .txt file for the Revenue
  Department's data transfer program
- Withholding tax certificates (50 Tavi), printable per document
- VAT rates are stored in a table with validity dates, so each document uses the rate
  in force on its own issue date rather than a hardcoded number
- Tax point handled separately for goods (Section 78) and services (Section 78/1)
- Full tax invoice completeness is checked against Section 86/4 before the document is issued

## Pricing

${priceLines}

Billing notes: staff accounts are unlimited on every plan. Plans are priced by AI usage
volume and number of businesses, not per user, because per-user pricing pushes small
shops into sharing one password — which is more dangerous than the money it saves.

## What it does not do

- No payroll module
- No bank feed connection (bank statements are imported as files, not linked live)
- No marketplace integration (Shopee, Lazada, TikTok Shop)
- No point-of-sale application
- It does not file returns with the Revenue Department on your behalf; it prepares the
  forms and the upload files, and a human submits them
- It is accounting software, not tax advice. Output should be reviewed by a licensed
  accountant before submission.

## Links

- Homepage: https://sudochatbot.online
- Pricing: https://sudochatbot.online/pricing
- All features: https://sudochatbot.online/features
- Thai accounting & tax guides: https://sudochatbot.online/guide
- Contact: support@sudochatbot.online · https://sudochatbot.online/contact
- Try without signing up: https://sudochatbot.online/try
- Terms: https://sudochatbot.online/terms
- Privacy: https://sudochatbot.online/privacy
- Thai-language version of this file: https://sudochatbot.online/llms.txt
`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
