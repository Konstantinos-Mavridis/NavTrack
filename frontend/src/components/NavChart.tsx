import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import type { NavPrice } from '../types';
import { useTheme } from '../ThemeContext';

interface Props {
  navHistory: NavPrice[];
}

export default function NavChart({ navHistory }: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const gridColor   = dark ? '#374151' : '#f3f4f6';
  const tickColor   = dark ? '#6b7280' : '#9ca3af';
  const tooltipBg   = dark ? '#1f2937' : '#ffffff';
  const tooltipBorder = dark ? '#374151' : '#e5e7eb';
  const tooltipLabel  = dark ? '#9ca3af' : '#6b7280';
  const tooltipText   = dark ? '#e5e7eb' : '#111827';

  if (!navHistory.length) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 dark:text-gray-500 text-sm">
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

  // Derive stroke colour from the overall trend of the series.
  const firstNav = data[0]?.nav ?? 0;
  const lastNav  = data[data.length - 1]?.nav ?? 0;
  const positive = lastNav >= firstNav;
  const strokeColor = positive ? '#10b981' : '#ef4444';

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: tickColor }}
          tickFormatter={(d: string) => d.slice(5)}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={[minNav, maxNav]}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 10, fill: tickColor }}
          tickFormatter={(v: number) => v.toFixed(2)}
          width={52}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: `1px solid ${tooltipBorder}`,
            backgroundColor: tooltipBg,
            fontSize: 12,
            color: tooltipText,
          }}
          formatter={(value) => {
            const nav =
              typeof value === 'number'
                ? value
                : Number(value ?? 0);
            return [`€${nav.toFixed(4)}`, 'NAV'];
          }}
          labelStyle={{ color: tooltipLabel }}
        />
        <Line
          type="monotone"
          dataKey="nav"
          stroke={strokeColor}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: strokeColor }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
