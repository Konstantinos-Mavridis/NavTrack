import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  AssetClassChip,
  ButtonSpinner,
  EmptyState,
  ErrorBanner,
  FIELD_LABEL_CLS,
  ModalErrorBanner,
  PnlCell,
  RiskBadge,
  SectionHeading,
  Spinner,
  StatCard,
  txBadgeColor,
} from './ui';

describe('ui helpers/components', () => {
  it('Spinner applies size-based inline dimensions', () => {
    const { container } = render(<Spinner size={5} />);
    const circle = container.querySelector('.rounded-full.border-4');
    expect(circle).toBeInTheDocument();
    expect(circle).toHaveStyle({ width: '20px', height: '20px' });
  });

  it('ButtonSpinner renders and appends custom className', () => {
    const { container } = render(<ButtonSpinner className="extra-spin" />);
    const spinner = container.querySelector('.extra-spin');
    expect(spinner).toBeInTheDocument();
  });

  it('ErrorBanner renders the provided message', () => {
    render(<ErrorBanner message="Something went wrong" />);
    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
  });

  it('ModalErrorBanner switches visibility classes based on error string', () => {
    const { container, rerender } = render(<ModalErrorBanner error="Bad input" />);
    expect(container.firstChild).toHaveClass('max-h-20');
    expect(screen.getByText('Bad input')).toBeInTheDocument();

    rerender(<ModalErrorBanner error="" />);
    expect(container.firstChild).toHaveClass('max-h-0');
  });

  it('exports a shared field-label class string', () => {
    expect(FIELD_LABEL_CLS).toContain('text-sm');
    expect(FIELD_LABEL_CLS).toContain('font-medium');
  });

  it('StatCard renders label, value, subtext and positive accent styling', () => {
    render(<StatCard label="PnL" value="+10.00" sub="today" accent="positive" />);
    expect(screen.getByText('PnL')).toBeInTheDocument();
    expect(screen.getByText('+10.00')).toHaveClass('text-emerald-600');
    expect(screen.getByText('today')).toBeInTheDocument();
  });

  it('PnlCell renders em-dash for null values', () => {
    render(<PnlCell value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('PnlCell renders positive values with sign and suffix', () => {
    render(<PnlCell value={12.5} suffix="%" />);
    const node = screen.getByText((content) => content.includes('+') && content.includes('%'));
    expect(node).toHaveClass('text-emerald-600');
  });

  it('PnlCell renders negative values with negative styling', () => {
    render(<PnlCell value={-3.5} />);
    const node = screen.getByText((content) => content.includes('-'));
    expect(node).toHaveClass('text-red-500');
  });

  it('SectionHeading renders title with trailing actions', () => {
    render(
      <SectionHeading title="Holdings">
        <button type="button">Action</button>
      </SectionHeading>,
    );
    expect(screen.getByText('Holdings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Action' })).toBeInTheDocument();
  });

  it('EmptyState renders the message', () => {
    render(<EmptyState message="No data yet" />);
    expect(screen.getByText('No data yet')).toBeInTheDocument();
  });

  it('RiskBadge renders SRI level and risk color classes', () => {
    render(<RiskBadge level={3} />);
    const badge = screen.getByText('SRI 3');
    expect(badge).toHaveClass('bg-yellow-100');
  });

  it('AssetClassChip maps known labels and falls back for unknown classes', () => {
    const { rerender } = render(<AssetClassChip ac="HIGH_YIELD" />);
    expect(screen.getByText('High Yield')).toBeInTheDocument();

    rerender(<AssetClassChip ac="CUSTOM_BUCKET" />);
    expect(screen.getByText('CUSTOM BUCKET')).toBeInTheDocument();
  });

  it('txBadgeColor maps all known types and has a default', () => {
    expect(txBadgeColor('BUY')).toContain('bg-blue-100');
    expect(txBadgeColor('SELL')).toContain('bg-red-100');
    expect(txBadgeColor('SWITCH')).toContain('bg-purple-100');
    expect(txBadgeColor('DIVIDEND_REINVEST')).toContain('bg-green-100');
    expect(txBadgeColor('UNKNOWN')).toContain('bg-gray-100');
  });
});
