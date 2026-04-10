import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { ASSET_CLASS_COLORS, ASSET_CLASS_LABELS } from '../utils/format';
import { useTheme } from '../ThemeContext';

interface Props {
  data: Record<string, number>;
  title: string;
  labelMap?: Record<string, string>;
  colorMap?: Record<string, string>;
}

export default function AllocationChart({
  data,
  title,
  labelMap = ASSET_CLASS_LABELS,
  colorMap = ASSET_CLASS_COLORS,
}: Props) {
  const { theme } = useTheme();
  const dark = theme === 'dark';

  const entries = Object.entries(data)
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a);

  if (!entries.length) {
    return (
      <div className="card p-6 flex items-center justify-center h-56 text-gray-400 text-sm">
        No allocation data
      </div>
    );
  }

  const chartData = entries.map(([key, value]) => ({
    name: labelMap[key] ?? key.replace(/_/g, ' '),
    value,
    key,
  }));

  return (
    <div className="card p-6">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.key}
                fill={colorMap[entry.key] ?? '#94a3b8'}
                stroke={dark ? '#1f2937' : 'white'}
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => {
              const pct =
                typeof value === 'number'
                  ? value
                  : Number(value ?? 0);
              return [`${pct.toFixed(1)}%`, String(name ?? '')];
            }}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${dark ? '#374151' : '#e5e7eb'}`,
              backgroundColor: dark ? '#1f2937' : '#ffffff',
              fontSize: 12,
              color: dark ? '#e5e7eb' : '#111827',
            }}
            labelStyle={{ color: dark ? '#9ca3af' : '#6b7280' }}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            formatter={(value) => (
              <span style={{ fontSize: 11, color: dark ? '#9ca3af' : '#6b7280' }}>{value}</span>
            )}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
