/* Service worker — รับ Web Push อย่างเดียว (ไม่ทำ offline cache เพื่อไม่ให้เสี่ยงเสิร์ฟหน้าเก่าค้าง) */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = { title: "SudoChatBot", body: "", url: "/dashboard" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch { /* payload ไม่ใช่ JSON */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "/dashboard" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/dashboard";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // มีแท็บเปิดอยู่แล้วให้โฟกัสแท็บนั้นแทนการเปิดใหม่รัวๆ
      for (const c of list) {
        if (c.url.includes("/dashboard") && "focus" in c) { c.navigate(target); return c.focus(); }
      }
      return self.clients.openWindow(target);
    }),
  );
});
