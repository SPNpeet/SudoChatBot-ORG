// ==== ตรวจสอบสลิปโอนเงิน (EasySlip / SlipOK) — ฝั่ง Next.js server ====
// port มาจาก edge function เดิม ใช้ key ระดับร้าน (rpc get_shop_slip_key)

export interface SlipResult {
  ok: boolean;
  verified: boolean;          // ผ่านการตรวจว่าเป็นสลิปจริง
  amount?: number;
  transRef?: string;
  receiverName?: string;
  receiverId?: string;        // เบอร์/พร้อมเพย์ปลายทาง (masked)
  senderName?: string;
  date?: string;
  raw?: unknown;
  error?: string;
}

/** EasySlip: https://developer.easyslip.com */
export async function verifyWithEasySlip(imageBytes: Uint8Array, apiKey: string): Promise<SlipResult> {
  try {
    const form = new FormData();
    form.append("file", new Blob([imageBytes as BlobPart], { type: "image/jpeg" }), "slip.jpg");
    const res = await fetch("https://developer.easyslip.com/api/v1/verify", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}` },
      body: form,
    });
    const j = await res.json();
    if (!res.ok || j.status !== 200) {
      return { ok: true, verified: false, raw: j, error: j.message ?? `easyslip ${res.status}` };
    }
    const d = j.data;
    return {
      ok: true, verified: true,
      amount: d?.amount?.amount,
      transRef: d?.transRef,
      receiverName: d?.receiver?.account?.name?.th ?? d?.receiver?.account?.name?.en,
      receiverId: d?.receiver?.account?.proxy?.account ?? d?.receiver?.account?.bank?.account,
      senderName: d?.sender?.account?.name?.th ?? d?.sender?.account?.name?.en,
      date: d?.date,
      raw: j,
    };
  } catch (e) {
    return { ok: false, verified: false, error: (e as Error).message };
  }
}

/** SlipOK: https://slipok.com — key รูปแบบ "branchId:apiKey" */
export async function verifyWithSlipOK(imageBytes: Uint8Array, apiKey: string): Promise<SlipResult> {
  try {
    const [branchId, key] = apiKey.includes(":") ? apiKey.split(":") : ["", apiKey];
    const form = new FormData();
    form.append("files", new Blob([imageBytes as BlobPart], { type: "image/jpeg" }), "slip.jpg");
    const res = await fetch(`https://api.slipok.com/api/line/apikey/${branchId}`, {
      method: "POST",
      headers: { "x-authorization": key },
      body: form,
    });
    const j = await res.json();
    if (!res.ok || !j.success) {
      return { ok: true, verified: false, raw: j, error: j.message ?? `slipok ${res.status}` };
    }
    const d = j.data;
    return {
      ok: true, verified: true,
      amount: d?.amount,
      transRef: d?.transRef,
      receiverName: d?.receiver?.displayName,
      receiverId: d?.receiver?.proxy?.value ?? d?.receiver?.account?.value,
      senderName: d?.sender?.displayName,
      date: d?.transDate,
      raw: j,
    };
  } catch (e) {
    return { ok: false, verified: false, error: (e as Error).message };
  }
}

/** ตรวจตาม provider ของร้าน — manual/ไม่มี key คืน verified=false แบบไม่ error */
export async function verifySlip(provider: string, apiKey: string | null, imageBytes: Uint8Array): Promise<SlipResult | null> {
  if (!apiKey || provider === "manual" || !provider) return null;
  if (provider === "easyslip") return verifyWithEasySlip(imageBytes, apiKey);
  if (provider === "slipok") return verifyWithSlipOK(imageBytes, apiKey);
  return null;
}
