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

  it('formats Firebase Auth error codes into actionable senior-friendly messages and resolves Firebase config cleanly', async () => {
    const { formatFirebaseAuthError, resolvedFirebaseConfig } = await import('../src/lib/firebase');
    expect(resolvedFirebaseConfig.projectId).toBe('gen-lang-client-0339283160');
    expect(resolvedFirebaseConfig.firestoreDatabaseId).toBeTruthy();

    expect(formatFirebaseAuthError({ code: 'auth/unauthorized-domain' })).toMatch(/Authorized domains/i);
    expect(formatFirebaseAuthError({ code: 'auth/operation-not-allowed' })).toMatch(/not enabled/i);
    expect(formatFirebaseAuthError({ code: 'auth/email-already-in-use' })).toMatch(/already exists/i);
    expect(formatFirebaseAuthError({ code: 'auth/invalid-credential' })).toMatch(/Invalid email or password/i);
    expect(formatFirebaseAuthError({ code: 'auth/popup-blocked' })).toMatch(/blocked the Google sign-in popup/i);
    expect(formatFirebaseAuthError({ code: 'auth/operation-not-supported-in-this-environment' })).toMatch(
      /full-page redirect/i
    );
    expect(formatFirebaseAuthError({ code: 'auth/account-exists-with-different-credential' })).toMatch(
      /another sign-in method/i
    );
    expect(formatFirebaseAuthError({ code: 'auth/credential-already-in-use' })).toMatch(/already linked/i);
  });

  it('never assigns admin role in client Firestore user profile sync and preserves non-admin Google user fields', async () => {
    const { buildUserProfileSyncPayload } = await import('../src/lib/firebase');

    const createPayload = buildUserProfileSyncPayload({
      uid: 'google_public_uid_123',
      isExisting: false,
      displayName: 'Everyday Google User',
      role: 'admin',
      preferredLanguage: 'en',
      textSize: 'large',
      theme: 'light',
      email: 'Everyday.User@gmail.com',
      photoURL: 'https://lh3.googleusercontent.com/a/example-photo',
    }) as Record<string, unknown>;

    expect(createPayload.uid).toBe('google_public_uid_123');
    expect(createPayload.email).toBe('everyday.user@gmail.com');
    expect(createPayload.photoURL).toBe('https://lh3.googleusercontent.com/a/example-photo');
    expect(createPayload.displayName).toBe('Everyday Google User');
    expect(createPayload.role).toBe('senior');
    expect(createPayload.createdAt).toBeDefined();
    expect(createPayload.updatedAt).toBeDefined();

    const updatePayload = buildUserProfileSyncPayload({
      uid: 'google_public_uid_123',
      isExisting: true,
      displayName: 'Everyday Google User Updated',
      role: 'caregiver',
      preferredLanguage: 'hi',
      textSize: 'xlarge',
      theme: 'dark',
      email: 'Everyday.User@gmail.com',
      photoURL: 'https://lh3.googleusercontent.com/a/updated-photo',
    }) as Record<string, unknown>;

    expect(updatePayload.role).toBeUndefined();
    expect(updatePayload.createdAt).toBeUndefined();
    expect(updatePayload.email).toBe('everyday.user@gmail.com');
    expect(updatePayload.photoURL).toBe('https://lh3.googleusercontent.com/a/updated-photo');
    expect(updatePayload.updatedAt).toBeDefined();
  });

  it('rejects HTML responses on API calls with ApiError instead of returning empty JSON, and clears token on 401', async () => {
    const { apiFetch, ApiError, buildApiUrl, getApiToken, setApiToken } = await import('../src/lib/api');

    expect(buildApiUrl('/api/health')).toBe('/api/health');

    setApiToken('sample-jwt-token');
    expect(getApiToken()).toBe('sample-jwt-token');

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('<!doctype html><html><body>Not API</body></html>', {
          status: 200,
          headers: { 'content-type': 'text/html' },
        })
      );

      await expect(apiFetch('/api/auth/me')).rejects.toMatchObject({
        code: 'INVALID_API_RESPONSE',
        status: 502,
      });

      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ ok: false, error: 'Unauthorized', code: 'UNAUTHORIZED' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        })
      );

      await expect(apiFetch('/api/auth/me')).rejects.toBeInstanceOf(ApiError);
      expect(getApiToken()).toBeNull();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
