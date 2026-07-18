"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";

/** ปุ่ม submit ที่ล็อกตัวเองระหว่างรอ server — กันกดรัวสร้างข้อมูลซ้ำ */
export default function SubmitButton({ children, pendingText }: { children: React.ReactNode; pendingText: string }) {
  const { pending } = useFormStatus();
  return (
    <Button className="mt-6 w-full" disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          {pendingText}
        </span>
      ) : children}
    </Button>
  );
}
