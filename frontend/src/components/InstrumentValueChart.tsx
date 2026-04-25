import type { Dispatch, SetStateAction } from 'react';
import type { NavPrice, PerformanceRange } from '../types';
import NavChart from './NavChart';

interface Props {
  data: NavPrice[];
  loading: boolean;
  error: string;
  selectedRange: PerformanceRange;
  onRangeChange: Dispatch<SetStateAction<PerformanceRange>>;
}

const RANGES: PerformanceRange[] = ['1M', '3M', '6M', '1Y', 'ALL'];

/**
 * Instrument NAV chart with range selector.
 * Used by InstrumentDetail.
 */
export default function InstrumentValueChart({
  data,
  loading,
  error,
  selectedRange,
  onRangeChange,
}: Props) {
  return (
    <div data-testid="instrument-value-chart">
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
        <NavChart navHistory={data} />
      )}
    </div>
  );
}
