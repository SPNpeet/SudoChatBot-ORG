"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function RevenueChart({ data }: { data: { date: string; revenue: number; orders: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#a3a3a3" }} axisLine={false} tickLine={false} width={48}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
          <Tooltip
            formatter={(v: number, name) => [
              name === "revenue" ? `${v.toLocaleString()} ฿` : v,
              name === "revenue" ? "ยอดขาย" : "ออเดอร์",
            ]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 12 }}
          />
          <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} fill="url(#rev)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
