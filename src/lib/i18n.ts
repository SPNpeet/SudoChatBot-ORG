// ============================================================
//  ภาษาของหน้าสาธารณะ (19 ส.ค. 2569)
//
//  ⚠️ ทำไมเพิ่งมี และทำไมทำแค่หน้าสาธารณะก่อน
//  เจ้าของเปิดเว็บแล้วเจอว่า "เปลี่ยนภาษาก็ไม่มีให้" — ที่ผ่านมาคนที่อ่านไทยไม่ออก
//  ต้องพึ่ง Google Translate ของเบราว์เซอร์ ซึ่งแปลชื่อปุ่มเพี้ยน
//  (เห็นจริงจากภาพหน้าจอ: "ลองสั่ง" กลายเป็น "Try ordering." · "ราคา" กลายเป็น "price")
//
//  ระบบทั้งหมดมี 259 ไฟล์ 30,000+ บรรทัด ข้อความไทยฝังอยู่ในโค้ดทุกจุด
//  แปลทั้งหมดรวดเดียวคืองานหลายวันและเสี่ยงพังกระจายในจังหวะที่กำลังจะขายลูกค้าใหม่
//  จึงทำเป็นขั้น: **หน้าสาธารณะก่อน** เพราะเป็นจุดเดียวที่ตัดสินว่าคนแปลกหน้าจะสมัครไหม
//  หน้าหลังล็อกอินยังเป็นไทยและจะทยอยตามมา
//
//  ⚠️ เก็บภาษาไว้ใน cookie ไม่ได้แยกเป็น /en/... เพราะการแยก route
//  ต้องรื้อ sitemap · canonical · JSON-LD ทั้งชุด ซึ่งตอนนี้ตั้งไว้ถูกแล้วและมีคอมเมนต์กำกับว่า
//  เคยตั้งผิดมาก่อน — แลกคือ Google เก็บได้ภาษาเดียว
//  ส่วนฝั่ง AI ครอบด้วย /llms-en.txt แทนแล้ว
//
//  ⚠️ ชื่อเอกสารและแบบภาษีไทยห้ามแปล (ใบกำกับภาษี · ภ.พ.30 · ภ.ง.ด.3/53 · 50 ทวิ)
//  เพราะเป็นชื่อทางการที่ต้องตรงกับแบบของสรรพากร ฉบับอังกฤษจึงคงคำเหล่านี้ไว้
//  แล้วอธิบายเป็นภาษาอังกฤษในวงเล็บแทน
// ============================================================
import { cookies } from "next/headers";

export type Lang = "th" | "en";

export const LANG_COOKIE = "lang";

/** อ่านภาษาจาก cookie — ไม่มี/ค่าแปลก = ไทย (ลูกค้าหลักคือคนไทย) */
export async function getLang(): Promise<Lang> {
  try {
    const v = (await cookies()).get(LANG_COOKIE)?.value;
    return v === "en" ? "en" : "th";
  } catch {
    return "th";
  }
}

export interface HomeCopy {
  nav: { pricing: string; login: string };
  hero: {
    line1: string; line2: string; lead: string;
    ctaPrimary: string; ctaSecondary: string;
    /** ⚠️ ราคาในแถบนี้ห้ามพิมพ์เป็นตัวเลขตายตัว — ประกอบจากตาราง plans ที่ page.tsx
     *  ขึ้นราคาแล้วลืมแก้โฆษณา = โฆษณาราคาที่ไม่มีจริง ซึ่งผิดกฎหมายคุ้มครองผู้บริโภค */
    pricePrefix: string; priceSuffix: string;
    trust: string[];
  };
  flowHead: { real: string; say: string; does: string; gets: string };
  outputsHead: { result: string; every: string };
  audienceHead: string;
  pricingHead: { cheap: string; straight: string; title: string };
  faqHead: string;
  finalCta: string;
  footer: { features: string; articles: string; pricing: string; about: string; refund: string; privacy: string; terms: string; deletion: string; contact: string };
  flow: { n: string; say: string; does: string; gets: string[] }[];
  outputs: { label: string; sub: string }[];
  audience: { title: string; lead: string; points: string[] }[];
  faqs: { q: string; a: string }[];
  heroCmd: { label: string; placeholder: string; send: string; note: string; examples: string[] };
  guestChat: { title: string; sub: string; chips: string[]; placeholder: string; send: string; error: string; offline: string };
  flowIntro: { title: string; lead: string };
  audienceNote: string;
  finalCtaLead: string;
  stickyCta: string;
  tagline: string;
  pricing: {
    from: string; baht: string; monthly: string; yearly: string; save2: string; perMonth: string;
    whenYearly: string; billedYearly: string; save: string; choose: string; popular: string; start: string;
    note: string;
    /** บรรทัดใต้การ์ดราคา — ต้องบอกให้ชัดว่าโควตาที่จำกัดคืองาน AI ไม่ใช่การคีย์เอกสาร */
    footnote: string;
    monthToMonth: string;
    billedOnce: string;
    freeNoCard: string;
    startFree: string;
    periodLabel: string;
    planGroupLabel: string;
  };
  /** ชื่อ+ฟีเจอร์ของแพ็ก จับจาก code เพราะชื่อในฐานข้อมูลเป็นไทยและเปลี่ยนได้ */
  plans: Record<string, { name: string; items: string[] }>;
}

const EN: HomeCopy = {
  nav: { pricing: "Pricing", login: "Log in" },
  hero: {
    line1: "AI does your books —",
    line2: "no second AI subscription",
    lead:
      "The AI accounting assistant lives inside this site. Open it and type. You do not need a ChatGPT or Claude account of your own — and the tax invoice, the debit\u2013credit journal entries and the Thai Revenue Department reports all come out of that one command.",
    ctaPrimary: "Start free",
    ctaSecondary: "Try issuing a document first",
    pricePrefix: "From", priceSuffix: "THB/month",
    trust: ["No credit card", "Money goes straight to your own account"],
  },
  flowHead: { real: "the real thing", say: "You type", does: "The system does", gets: "You get back" },
  outputsHead: { result: "the result", every: "Every round ends with" },
  audienceHead: "Works on both sides of the desk",
  pricingHead: { cheap: "how cheap", straight: "we keep it straight", title: "Straightforward pricing" },
  faqHead: "Frequently asked questions",
  finalCta: "Issue your first document in 3 minutes",
  footer: {
    features: "All features", articles: "Accounting & tax articles", pricing: "Pricing",
    about: "About us", refund: "Refund policy",
    privacy: "Privacy policy", terms: "Terms of use", deletion: "Data deletion", contact: "Contact us",
  },
  flow: [
    {
      n: "01",
      say: "Issue an invoice for web design, 25,000 baht, to Siam Trade, add VAT, withhold 3%",
      does: "Calculates VAT and withholding tax per Thai law, books the receivable, and posts the full debit–credit entry",
      gets: ["Invoice + ใบกำกับภาษี (tax invoice)", "A payment link your customer can scan", "Journal entry recorded"],
    },
    {
      n: "02",
      say: "(send in a photo of the electricity bill)",
      does: "Reads the amount, separates input VAT, categorises the expense, and asks you back when the image is unclear instead of guessing",
      gets: ["Expense recorded with input VAT", "The bill image attached for later audit"],
    },
    {
      n: "03",
      say: "The customer transferred the money, clear the balance",
      does: "Matches the transfer slip to the invoice, checks the whole system for duplicate slips, and clears the receivable",
      gets: ["Receipt issued", "Receivable balance updated instantly"],
    },
    {
      n: "04",
      say: "What do I have to file this month?",
      does: "Summarises output and input VAT from the actual journal, not from data you key in a second time",
      gets: ["ภ.พ.30 · ภ.ง.ด.3/53 · 50 ทวิ", "Upload files for the Revenue Department program"],
    },
  ],
  heroCmd: {
    label: "Type an accounting command",
    placeholder: "Just type it, e.g. issue an invoice for 5,000 to Mr Somchai",
    send: "Try it",
    note: "3 free tries. No sign-up. No card.",
    examples: [
      "Photograph this electricity bill and book it for me",
      "Issue an invoice for web design, 25,000 baht, to Siam Trade, add VAT",
      "What do I have to file this month?",
      "Who has owed us money for more than 30 days?",
    ],
  },
  guestChat: {
    title: "Try talking to the AI accounting assistant",
    sub: "No sign-up · 3 free tries",
    chips: ["What can this system do?", "How does it help with tax?", "Is it suitable for an accounting firm?"],
    placeholder: "Ask a short question...",
    send: "Send question",
    error: "Something went wrong. Please try again.",
    offline: "Could not connect. Please try again.",
  },
  flowIntro: {
    title: "What you type, and what you get back",
    lead: "The middle column is the work ordinary accounting software leaves to you — here the system does it from the first sentence.",
  },
  audienceNote: "Documents are cancelled by reversal, auditable forever. Numbers are never edited without a trace.",
  finalCtaLead: "Sign up free, no card needed — you can command the assistant in plain language from the very first document.",
  stickyCta: "Start free, no card needed",
  tagline: "SudoChatBot — online accounting with an AI accounting assistant, for Thai SMEs",
  pricing: {
    from: "Starting at", baht: "THB", monthly: "Monthly", yearly: "Yearly", save2: "2 months free",
    perMonth: "per month", whenYearly: "· when paid yearly", billedYearly: "billed once a year",
    save: "Save", choose: "Choose this plan", popular: "Most popular", start: "Start with",
    note: "No setup fee, no joining fee, no lock-in contract — and no per-user charge. Invite your whole sales and admin team at no extra cost.",
    footnote: "Unlimited manual document entry on every plan, even when the AI quota runs out · only AI work (assistant + bill reading) is metered · prices exclude VAT.",
    monthToMonth: "Pay month to month, cancel any time",
    billedOnce: "Billed once a year",
    freeNoCard: "Free, no card needed",
    startFree: "Start free",
    periodLabel: "Billing period",
    planGroupLabel: "Choose a plan",
  },
  plans: {
    free: { name: "Free trial", items: ["1 business", "Unlimited manual documents and bookkeeping", "15 AI commands/month", "10 automatic slip checks/month", "Unlimited staff"] },
    starter: { name: "Starter", items: ["1 business", "Full documents, bookkeeping and tax, unlimited manual entry", "100 AI commands/month", "100 automatic slip checks/month", "Unlimited staff"] },
    professional: { name: "Business", items: ["Up to 3 businesses (shared quota)", "Journal + 50 ทวิ + AI bill reading", "400 AI commands/month", "200 automatic slip checks/month", "Cheaper than the market leader, with an AI assistant they do not have"] },
    executive: { name: "Accounting firm", items: ["Up to 10 businesses", "Revenue Department filing files ภ.พ.30 / ภ.ง.ด. (.txt)", "1,000 AI commands/month", "500 automatic slip checks/month", "Full-period Excel pack for your accountant"] },
    agency: { name: "Large accounting firm", items: ["Unlimited businesses", "Everything in Accounting firm", "3,000 AI commands/month", "Unlimited automatic slip checks", "Audit log + strict client data isolation (RLS)"] },
  },
  outputs: [
    { label: "ใบกำกับภาษี (tax invoice)", sub: "Complete under Section 86/4" },
    { label: "Journal", sub: "Debit–credit posted automatically" },
    { label: "ภ.พ.30 ready to file", sub: "File for the Revenue Department program" },
  ],
  audience: [
    {
      title: "Business owners",
      lead: "No accounting knowledge needed",
      points: [
        "Type a command or photograph a bill — no menus to learn",
        "Send customers a link to scan and pay; the system clears the balance itself",
        "Know in advance how much tax is due this month",
        "Hand the whole period to your accounting firm as Excel",
      ],
    },
    {
      title: "Accounting firms",
      lead: "Many client businesses in one account",
      points: [
        "Switch between businesses; data is isolated by Row-Level Security",
        "ภ.พ.30 / ภ.ง.ด. filing files for every client",
        "Closing a period locks it at the database level — no back-dated edits",
        "Every change has an audit log showing who did what",
      ],
    },
  ],
  faqs: [
    { q: "I know nothing about accounting. Can I still use it?", a: "Yes. You issue a document or photograph a bill; the system posts the debit and credit for you following double-entry rules. Everything an accountant needs (journal, trial balance, tax reports) is prepared and can be handed straight to your accounting firm." },
    { q: "How is this different from ordinary accounting software?", a: "The AI is the point: type a plain-language command or photograph a bill and it is booked, with no complex menus to learn. It also gives you a payment link where the customer scans a QR code and uploads the slip themselves; the system verifies genuine and duplicate slips and clears the balance automatically." },
    { q: "Can an accounting firm manage many clients?", a: "Yes. One account can create and switch between multiple businesses, with data isolated by Row-Level Security. Every change has an audit log, and you can invite staff with role-based permissions." },
    { q: "Whose bank account does the money go into?", a: "Yours, directly. The payment link uses your own business PromptPay. We are not a middleman holding your money and we do not take a percentage of your sales." },
    { q: "How trustworthy are the numbers, and who is responsible if they are wrong?", a: "An automated test suite runs before every release: 400,000 rounding cases checking that pre-tax value plus VAT always equals the total; that the withholding tax base is computed on the pre-VAT amount rather than the total; that depreciation over an asset's life leaves exactly the salvage value; and that tax reports match the journal every month. Even so, this is a tool, not your accountant — figures you actually file should always be reviewed by your bookkeeper or auditor first." },
    { q: "The 7% VAT rate is due to expire. Does the system handle that?", a: "Yes. Tax rates are stored in a table with start and end dates, and each document uses the rate in force on its own issue date rather than a number fixed in the code. If a new decree has not been published yet, the system says the rate is unknown instead of guessing." },
    { q: "Does it work for a service business selling on credit?", a: "Yes. When issuing an invoice you choose goods or services. For services sold on credit, output VAT is deferred under Section 78/1 and recognised into ภ.พ.30 in the month the customer actually pays. Payments split across months are apportioned correctly." },
    { q: "Is it hard to cancel, and who owns the data?", a: "There is no lock-in contract; stop whenever you like. The data is yours — download reports as Excel at any time, and request deletion under the privacy policy." },
  ],
};

/** ฉบับไทย = null แปลว่า "ใช้ข้อความเดิมที่อยู่ในหน้า" — ไม่ย้ายข้อความไทยมาที่นี่
 *  เพื่อไม่ให้หน้าไทยซึ่งลูกค้าปัจจุบันใช้อยู่เปลี่ยนไปแม้แต่ตัวอักษรเดียว */
export function homeCopy(lang: Lang): HomeCopy | null {
  return lang === "en" ? EN : null;
}
