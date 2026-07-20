export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="SudoChatBot" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
      <span className="text-[15px] font-bold tracking-tight text-neutral-900">Sudo<span className="text-emerald-600">ChatBot</span></span>
    </span>
  );
}
