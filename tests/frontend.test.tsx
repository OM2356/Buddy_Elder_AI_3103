// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PhoneSimulator } from '../src/components/PhoneSimulator';
import { ErrorBanner, EmptyState } from '../src/components/StateViews';
import { AccessibilityProvider } from '../src/context/AccessibilityContext';
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
