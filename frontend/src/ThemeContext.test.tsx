import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeConsumer() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={() => setTheme('dark')}>Set Dark</button>
      <button onClick={() => setTheme('light')}>Set Light</button>
      <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>Toggle</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('provides a valid initial theme', () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
    expect(['light', 'dark']).toContain(screen.getByTestId('theme-value').textContent);
  });

  it('setTheme switches to dark', async () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Set Dark' }));
    expect(screen.getByTestId('theme-value').textContent).toBe('dark');
  });

  it('setTheme switches back to light', async () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button', { name: 'Set Dark' }));
    await userEvent.click(screen.getByRole('button', { name: 'Set Light' }));
    expect(screen.getByTestId('theme-value').textContent).toBe('light');
  });

  it('toggle button alternates the theme twice and returns to original', async () => {
    render(<ThemeProvider><ThemeConsumer /></ThemeProvider>);
    const el = screen.getByTestId('theme-value');
    const before = el.textContent;
    await userEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(el.textContent).not.toBe(before);
    await userEvent.click(screen.getByRole('button', { name: 'Toggle' }));
    expect(el.textContent).toBe(before);
  });
});
