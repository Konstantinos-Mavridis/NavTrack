/**
 * ConfirmDialog has no `open` prop — visibility is controlled by the parent
 * mounting or unmounting the component. It always renders when in the tree.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

const baseProps = {
  title: 'Delete portfolio',
  message: 'Are you sure you want to delete this portfolio?',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmDialog', () => {
  it('renders title and message', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByText('Delete portfolio')).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it('renders Cancel and Confirm buttons', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
  });

  it('calls onConfirm when confirm button is clicked', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /confirm/i }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog {...baseProps} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not call onConfirm when cancel is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog {...baseProps} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('renders a custom confirmLabel', () => {
    render(<ConfirmDialog {...baseProps} confirmLabel="Remove" />);
    expect(screen.getByRole('button', { name: /remove/i })).toBeInTheDocument();
  });

  it('applies btn-danger class by default', () => {
    render(<ConfirmDialog {...baseProps} />);
    expect(screen.getByRole('button', { name: /confirm/i }).className).toMatch(/btn-danger/);
  });
});
