"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

/** ปุ่ม submit กลาง — ล็อกตัวเอง + สปินเนอร์ระหว่างรอ server action (กันกดซ้ำ + ให้ feedback ว่ากำลังทำงาน) */
export default function SubmitButton({
  children, pendingText, className, variant, size,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md";
}) {
  const { pending } = useFormStatus();
  return (
    <Button className={cn(className)} variant={variant} size={size} disabled={pending}>
      {pending ? (
        <span className="flex items-center gap-2">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
          {pendingText ?? "กำลังดำเนินการ..."}
        </span>
      ) : children}
    </Button>
  );
}
