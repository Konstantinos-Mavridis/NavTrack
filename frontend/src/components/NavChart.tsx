import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { NavPrice } from '../types';

interface Props {
  navHistory: NavPrice[];
}

export default function NavChart({ navHistory }: Props) {
  if (!navHistory.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No NAV data yet
      </div>
    );
  }

  const data = navHistory.map((n) => ({
    date: n.date,
    nav: Number(n.nav),
  }));

  const minNav = Math.min(...data.map((d) => d.nav)) * 0.99;
  const maxNav = Math.max(...data.map((d) => d.nav)) * 1.01;

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(d: string) => d.slice(5)} // show MM-DD
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minNav, maxNav]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          tickFormatter={(v: number) => v.toFixed(2)}
          width={52}
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
          formatter={(v: number) => [`€${v.toFixed(4)}`, 'NAV']}
          labelStyle={{ color: '#6b7280' }}
        />
        <Line
          type="monotone"
          dataKey="nav"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: '#3b82f6' }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
