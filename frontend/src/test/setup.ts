/**
 * Vitest global setup
 *
 * - Extends expect() with @testing-library/jest-dom matchers
 *   (toBeInTheDocument, toHaveTextContent, etc.)
 * - Stubs out browser APIs that jsdom does not implement
 */
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// recharts uses ResizeObserver internally
global.ResizeObserver = class {
  observe()    {}
  unobserve()  {}
  disconnect() {}
};

// matchMedia is not implemented in jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
