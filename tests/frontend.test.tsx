// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import fs from 'fs';
import path from 'path';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PhoneSimulator } from '../src/components/PhoneSimulator';
import { ErrorBanner, EmptyState, SafeImage } from '../src/components/StateViews';
import { AccessibilityProvider } from '../src/context/AccessibilityContext';
import AboutPage from '../src/pages/AboutPage';
import LandingPage from '../src/pages/LandingPage';

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false }),
}));

describe('Buddy Elder AI Frontend Components', () => {
  it('renders LandingPage with Buddy Elder AI branding and Indian helplines', () => {
    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <LandingPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    expect(screen.getByText(/Technology that respects your pace/i)).toBeInTheDocument();
    expect(screen.getByText(/112 \(Emergency\)/i)).toBeInTheDocument();
    expect(screen.getByText(/1930 \(Cyber Fraud\)/i)).toBeInTheDocument();
  });

  it('verifies all public images across LandingPage and AboutPage exist in public/ and have descriptive alt text', () => {
    const { container } = render(
      <AccessibilityProvider>
        <MemoryRouter>
          <LandingPage />
          <AboutPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    const imgs = Array.from(container.querySelectorAll('img'));
    expect(imgs.length).toBe(5);

    const publicDir = path.resolve(process.cwd(), 'public');
    expect(fs.existsSync(path.join(publicDir, 'favicon.svg'))).toBe(true);
    expect(fs.existsSync(path.join(publicDir, 'images/fallback-companion.svg'))).toBe(true);

    for (const img of imgs) {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      expect(src).toMatch(/^\/images\/[a-z0-9-]+\.(jpg|jpeg|png|webp|svg)$/);
      expect(src).not.toContain('/src/assets/');
      expect(alt.trim().length).toBeGreaterThan(10);

      const diskPath = path.join(publicDir, src.replace(/^\//, ''));
      expect(fs.existsSync(diskPath)).toBe(true);
      expect(fs.statSync(diskPath).size).toBeGreaterThan(1000);
    }
  });

  it('falls back cleanly in SafeImage from primary error -> local SVG fallback -> accessible label', () => {
    render(
      <SafeImage
        src="/images/non-existent.jpg"
        alt="Family support companion illustration"
      />
    );

    const primaryImg = screen.getByRole('img', { name: /Family support companion illustration/i });
    expect(primaryImg).toHaveAttribute('src', '/images/non-existent.jpg');

    fireEvent.error(primaryImg);
    const fallbackImg = screen.getByRole('img', { name: /Family support companion illustration/i });
    expect(fallbackImg).toHaveAttribute('src', '/images/fallback-companion.svg');

    fireEvent.error(fallbackImg);
    expect(screen.getByText('Family support companion illustration')).toBeInTheDocument();
  });

  it('guides senior learners interactively in PhoneSimulator', () => {
    render(<PhoneSimulator />);

    fireEvent.click(screen.getByRole('button', { name: /UPI Safety/i }));
    expect(screen.getByText(/Practice Alert: Stranger Requests PIN/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Decline & Block \(Safe\)/i }));
    expect(screen.getByText(/Well done! Declining and blocking unknown UPI PIN requests/i)).toBeInTheDocument();
  });

  it('renders ErrorBanner and EmptyState with working handlers', () => {
    const retryFn = vi.fn();
    render(
      <>
        <ErrorBanner message="Network connection dropped." onRetry={retryFn} />
        <EmptyState title="Nothing here" description="Add your first item." actionLabel="Create Item" onAction={retryFn} />
      </>
    );

    fireEvent.click(screen.getByRole('button', { name: /Try Again/i }));
    fireEvent.click(screen.getByRole('button', { name: /Create Item/i }));
    expect(retryFn).toHaveBeenCalledTimes(2);
  });
});
