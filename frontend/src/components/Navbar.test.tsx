/**
 * Tests for Navbar component
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '../ThemeContext';
import Navbar from './Navbar';

function renderNavbar() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <Navbar />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe('Navbar', () => {
  it('renders the NavTrack brand name', () => {
    renderNavbar();
    expect(screen.getByText(/navtrack/i)).toBeInTheDocument();
  });

  it('contains navigation links', () => {
    renderNavbar();
    const links = screen.getAllByRole('link');
    expect(links.length).toBeGreaterThan(0);
  });

  it('contains a theme toggle button', () => {
    renderNavbar();
    // The toggle should be a button element
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThan(0);
  });
});
