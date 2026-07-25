"use client";
// เปิดแจ้งเตือนบนเครื่องนี้ — คลิกเดียว ไม่ต้องตั้งค่าอะไร (ใช้ได้แม้ไม่ได้เชื่อม LINE)
import { useEffect, useState } from "react";
import { Bell, BellOff, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui";

type State = "checking" | "unsupported" | "denied" | "off" | "on";

function urlB64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export default function PushToggle({ shopId }: { shopId: string }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
        setState("unsupported"); return;
      }
      if (Notification.permission === "denied") { setState("denied"); return; }
      try {
        const reg = await navigator.serviceWorker.getRegistration("/sw.js");
        const sub = await reg?.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch { setState("off"); }
    })();
  }, []);

  async function enable() {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return; }

      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/subscribe");
      const keyJson = await keyRes.json();
      if (!keyJson.ok) { setMsg("ขอคีย์แจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง"); return; }

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlB64ToUint8Array(keyJson.publicKey),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON(), shop_id: shopId }),
      });
      const j = await res.json();
      if (!j.ok) { setMsg(j.error ?? "บันทึกไม่สำเร็จ"); return; }
      setState("on");
      setMsg("เปิดแล้ว — เครื่องนี้จะได้รับแจ้งเตือนสำคัญจากระบบ");
    } catch (e) {
      setMsg(`เปิดไม่สำเร็จ: ${(e as Error).message.slice(0, 80)}`);
    } finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setState("off");
      setMsg("ปิดแจ้งเตือนบนเครื่องนี้แล้ว");
    } finally { setBusy(false); }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 p-4">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Smartphone className="h-4 w-4 text-emerald-600" /> แจ้งเตือนบนเครื่องนี้ (ฟรี ไม่จำกัด)
      </p>
      <p className="mt-1 text-xs text-neutral-500">
        ใช้ได้ทันทีโดยไม่ต้องเชื่อม LINE — ระบบจะเด้งเตือนเรื่องสำคัญ เช่น ระบบขัดข้อง/ปิดปรับปรุง
      </p>

      {state === "on" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> เปิดอยู่บนเครื่องนี้
          </span>
          <Button type="button" size="sm" variant="outline" onClick={disable} disabled={busy}>
            <BellOff className="h-3.5 w-3.5" /> ปิด
          </Button>
        </div>
      )}
      {state === "off" && (
        <Button type="button" size="sm" className="mt-3" onClick={enable} disabled={busy}>
          <Bell className="h-3.5 w-3.5" /> {busy ? "กำลังเปิด..." : "เปิดแจ้งเตือนบนเครื่องนี้"}
        </Button>
      )}
      {state === "denied" && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
          เบราว์เซอร์บล็อกการแจ้งเตือนไว้ — เปิดใหม่ได้ที่ไอคอนแม่กุญแจข้าง URL → การแจ้งเตือน → อนุญาต
        </p>
      )}
      {state === "unsupported" && (
        <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          เบราว์เซอร์นี้ยังไม่รองรับ — บน iPhone ให้กด &ldquo;แชร์ → เพิ่มไปยังหน้าจอโฮม&rdquo; แล้วเปิดจากไอคอนนั้นก่อน
        </p>
      )}
      {msg && <p className="mt-2 text-xs text-neutral-600">{msg}</p>}
    </div>
  );
}
