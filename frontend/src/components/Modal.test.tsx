/**
 * Modal has no `open` prop — it renders unconditionally when mounted.
 * The parent conditionally renders it.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Modal from './Modal';

describe('Modal', () => {
  it('renders title and children', () => {
    render(<Modal title="Test Modal" onClose={vi.fn()}><p>body text</p></Modal>);
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByText('body text')).toBeInTheDocument();
  });

  it('renders an optional subtitle', () => {
    render(<Modal title="T" subtitle="Sub" onClose={vi.fn()}><p>b</p></Modal>);
    expect(screen.getByText('Sub')).toBeInTheDocument();
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(<Modal title="Close me" onClose={onClose}><p>b</p></Modal>);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does NOT call onClose when closeable=false', async () => {
    const onClose = vi.fn();
    render(<Modal title="Locked" onClose={onClose} closeable={false}><p>b</p></Modal>);
    await userEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies default width class max-w-lg', () => {
    const { container } = render(<Modal title="W" onClose={vi.fn()}><p>b</p></Modal>);
    expect(container.querySelector('.max-w-lg')).toBeInTheDocument();
  });

  it('applies a custom width class', () => {
    const { container } = render(<Modal title="W" onClose={vi.fn()} width="max-w-2xl"><p>b</p></Modal>);
    expect(container.querySelector('.max-w-2xl')).toBeInTheDocument();
  });
});
