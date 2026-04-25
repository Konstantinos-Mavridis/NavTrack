import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import type { Instrument, PricePoint, PerformanceRange } from '../types';
import { Spinner, ErrorBanner } from '../components/ui';
import InstrumentValueChart from '../components/InstrumentValueChart';
import { fmtEur, fmtPct, today } from '../utils/format';

const RANGE_DAYS: Record<PerformanceRange, number | undefined> = {
  '1M':  30,
  '3M':  90,
  '6M':  180,
  '1Y':  365,
  'ALL': undefined,
};

export default function InstrumentDetail() {
  const { id } = useParams<{ id: string }>();

  const [instrument,    setInstrument]    = useState<Instrument | null>(null);
  const [prices,        setPrices]        = useState<PricePoint[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [chartLoading,  setChartLoading]  = useState(false);
  const [chartError,    setChartError]    = useState('');
  const [selectedRange, setSelectedRange] = useState<PerformanceRange>('1M');

  useEffect(() => {
    async function load() {
      try {
        const inst = await api.instruments.get(id!);
        setInstrument(inst);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  useEffect(() => {
    if (!instrument) return;
    async function loadPrices() {
      setChartLoading(true);
      setChartError('');
      try {
        const days = RANGE_DAYS[selectedRange];
        const pts  = await api.prices.history(id!, days, today());
        setPrices(pts);
      } catch (e: any) {
        setChartError(e.message);
      } finally {
        setChartLoading(false);
      }
    }
    loadPrices();
  }, [instrument, selectedRange, id]);

  if (loading) return <Spinner />;
  if (error || !instrument) return <div className="p-6"><ErrorBanner message={error || 'Not found'} /></div>;

  const latestPrice  = prices.at(-1)?.price ?? instrument.latestPrice ?? null;
  const earliestPrice = prices.at(0)?.price ?? null;
  const priceChange  = latestPrice != null && earliestPrice != null && earliestPrice !== 0
    ? (latestPrice - earliestPrice) / earliestPrice
    : null;
  const positive = (priceChange ?? 0) >= 0;

  return (
    <div className="max-w-5xl mx-auto px-4 pt-6 pb-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        <Link to="/portfolios" className="hover:text-blue-600 dark:hover:text-blue-400">Portfolios</Link>
        <span className="mx-1">/</span>
        <span className="text-gray-800 dark:text-gray-200 font-medium">{instrument.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">{instrument.name}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{instrument.id} · {instrument.type}</p>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Latest Price</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {latestPrice != null ? `€${fmtEur(latestPrice)}` : '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Period Return</p>
          <p className={`text-2xl font-bold ${
            positive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
          }`}>
            {priceChange != null ? `${positive ? '+' : ''}${fmtPct(priceChange * 100)}` : '—'}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Data Points</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{prices.length}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="mb-6">
        <InstrumentValueChart
          data={prices}
          loading={chartLoading}
          error={chartError}
          selectedRange={selectedRange}
          onRangeChange={setSelectedRange}
        />
      </div>

      {/* Price History Table */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Price History</h2>
        {prices.length === 0 ? (
          <div className="text-center py-12 text-gray-400 dark:text-gray-500">
            <p className="text-3xl mb-2">📉</p>
            <p className="text-sm">No price data available for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="table-th">Date</th>
                  <th className="table-th text-right">Price</th>
                  <th className="table-th text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {[...prices].reverse().map((pt, idx, arr) => {
                  const prev = arr[idx + 1];
                  const chg  = prev ? (pt.price - prev.price) / prev.price : null;
                  const pos  = (chg ?? 0) >= 0;
                  return (
                    <tr key={pt.date} className="table-row">
                      <td className="table-td text-gray-500 dark:text-gray-400">{pt.date}</td>
                      <td className="table-td text-right font-mono">€{fmtEur(pt.price)}</td>
                      <td className={`table-td text-right font-mono ${
                        chg === null ? 'text-gray-400'
                          : pos ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-500 dark:text-red-400'
                      }`}>
                        {chg === null ? '—' : `${pos ? '+' : ''}${fmtPct(chg * 100)}`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
