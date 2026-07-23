"use client";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export default function PrintButton() {
  return (
    <Button size="sm" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> พิมพ์ / บันทึก PDF
    </Button>
  );
}
