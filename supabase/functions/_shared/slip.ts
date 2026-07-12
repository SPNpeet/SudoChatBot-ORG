// ==== ตรวจสอบสลิปโอนเงิน (EasySlip / SlipOK / manual) ====

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

function b64(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(bin);
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

/** SlipOK: https://slipok.com — ต้องมี branch id ใน key รูปแบบ "branchId:apiKey" */
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
