/**
 * Unit tests for ThemeContext
 *
 * Verifies that the provider exposes the theme value and that the toggle
 * function cycles between 'light' and 'dark'.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

// Small test consumer
function ThemeConsumer() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme-value">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('provides an initial theme value', () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );
    const value = screen.getByTestId('theme-value').textContent;
    expect(['light', 'dark']).toContain(value);
  });

  it('toggles from light to dark', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    const themeEl = screen.getByTestId('theme-value');
    const button  = screen.getByRole('button', { name: /toggle/i });
    const initial = themeEl.textContent as string;

    await userEvent.click(button);

    const toggled = themeEl.textContent as string;
    expect(toggled).not.toBe(initial);
    expect(['light', 'dark']).toContain(toggled);
  });

  it('toggles back to the original theme on second click', async () => {
    render(
      <ThemeProvider>
        <ThemeConsumer />
      </ThemeProvider>,
    );

    const themeEl = screen.getByTestId('theme-value');
    const button  = screen.getByRole('button', { name: /toggle/i });
    const initial = themeEl.textContent as string;

    await userEvent.click(button);
    await userEvent.click(button);

    expect(themeEl.textContent).toBe(initial);
  });
});
