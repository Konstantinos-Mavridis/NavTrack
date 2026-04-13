/**
 * Tests for ConfirmDialog
 *
 * Verifies rendering, button labelling, and callback invocation.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

const baseProps = {
  open: true,
  title: 'Delete portfolio',
  message: 'Are you sure you want to delete this portfolio?',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(<ConfirmDialog {...baseProps} open={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders title and message when open=true', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Delete portfolio')).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /confirm|delete|yes/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel|no/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onConfirm when cancel is clicked', async () => {
    const onConfirm = vi.fn();
    const onCancel  = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel|no/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
