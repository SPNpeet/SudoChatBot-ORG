export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7A2.5 2.5 0 0 1 17.5 16H9l-4 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-7Z" fill="currentColor" opacity=".95"/>
          <path d="M8.5 10.5h7M8.5 8h4" stroke="#0f9d6e" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </span>
      <span className="text-[15px] font-bold tracking-tight text-neutral-900">Sudo<span className="text-emerald-600">ChatBot</span></span>
    </span>
  );
}
