import type { Dispatch, SetStateAction } from 'react';
import type { NavPrice, PerformanceRange } from '../types';
import NavChart from './NavChart';

interface Props {
  data: { date: string; value: number }[];
  loading: boolean;
  error: string;
  selectedRange: PerformanceRange;
  onRangeChange: Dispatch<SetStateAction<PerformanceRange>>;
}

const RANGES: PerformanceRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

/**
 * Portfolio aggregate value chart with range selector.
 * Adapts { date, value } points to the NavPrice shape expected by NavChart.
 * Used by PortfolioDetail.
 */
export default function PortfolioValueChart({
  data,
  loading,
  error,
  selectedRange,
  onRangeChange,
}: Props) {
  const adapted: NavPrice[] = data.map((pt) => ({
    id: pt.date,
    instrumentId: '',
    date: pt.date,
    nav: pt.value,
    source: '',
    createdAt: pt.date,
  }));

  return (
    <div data-testid="portfolio-value-chart">
      <div className="flex gap-2 mb-3">
        {RANGES.map((r) => (
          <button
            key={r}
            onClick={() => onRangeChange(r)}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              selectedRange === r
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            {r}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="h-48 flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
          Loading…
        </div>
      ) : error ? (
        <div className="h-48 flex items-center justify-center text-red-500 text-sm">{error}</div>
      ) : (
        <NavChart navHistory={adapted} />
      )}
    </div>
  );
}
