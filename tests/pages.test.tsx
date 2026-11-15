// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AccessibilityProvider, useAccessibility } from '../src/context/AccessibilityContext';
import AboutPage from '../src/pages/AboutPage';
import FeaturesPage from '../src/pages/FeaturesPage';
import AssistantPage from '../src/pages/AssistantPage';
import AudioReaderPage from '../src/pages/AudioReaderPage';
import WellnessPage from '../src/pages/WellnessPage';
import RemindersPage from '../src/pages/RemindersPage';
import SettingsPage from '../src/pages/SettingsPage';
import CaregiverDashboard from '../src/pages/CaregiverDashboard';
import AdminDashboard from '../src/pages/AdminDashboard';

const mockApiFetch = vi.fn();

vi.mock('../src/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  getApiToken: () => 'test-token',
  setApiToken: vi.fn(),
}));

vi.mock('../src/lib/firebase', () => ({
  syncWellnessToFirestore: vi.fn().mockResolvedValue(undefined),
  syncReminderToFirestore: vi.fn().mockResolvedValue(undefined),
}));

let mockUser: { id: string; email: string; full_name: string; role: 'senior' | 'caregiver' | 'admin'; preferred_language: 'en' | 'hi' | 'mr' } = {
  id: 'usr_1',
  email: 'asha@example.com',
  full_name: 'Asha Deshmukh',
  role: 'senior',
  preferred_language: 'en',
};

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    logout: vi.fn(),
    refreshUser: vi.fn().mockResolvedValue(undefined),
  }),
}));

function A11yProbe() {
  const { language, textSize, theme, t, setLanguage, setTextSize, setTheme } = useAccessibility();
  return (
    <div>
      <span data-testid="lang-val">{language}</span>
      <span data-testid="greeting-val">{t.home.greeting}</span>
      <span data-testid="size-val">{textSize}</span>
      <span data-testid="theme-val">{theme}</span>
      <button type="button" onClick={() => setLanguage('hi', false)}>Switch Hindi</button>
      <button type="button" onClick={() => setLanguage('mr', false)}>Switch Marathi</button>
      <button type="button" onClick={() => setTextSize('xlarge', false)}>Max Text</button>
      <button type="button" onClick={() => setTheme('dark', false)}>Dark Mode</button>
    </div>
  );
}

describe('Buddy Elder AI Full UI & Accessibility Page Suite', () => {
  beforeEach(() => {
    mockApiFetch.mockReset();
    mockUser = {
      id: 'usr_1',
      email: 'asha@example.com',
      full_name: 'Asha Deshmukh',
      role: 'senior',
      preferred_language: 'en',
    };
  });

  it('switches English/Hindi/Marathi, text size, and dark mode cleanly in AccessibilityContext', () => {
    render(
      <AccessibilityProvider>
        <A11yProbe />
      </AccessibilityProvider>
    );

    expect(screen.getByTestId('greeting-val')).toHaveTextContent(/Good day/i);

    fireEvent.click(screen.getByRole('button', { name: /Switch Hindi/i }));
    expect(screen.getByTestId('lang-val')).toHaveTextContent('hi');
    expect(screen.getByTestId('greeting-val')).toHaveTextContent(/नमस्ते/);

    fireEvent.click(screen.getByRole('button', { name: /Switch Marathi/i }));
    expect(screen.getByTestId('lang-val')).toHaveTextContent('mr');
    expect(screen.getByTestId('greeting-val')).toHaveTextContent(/नमस्कार/);

    fireEvent.click(screen.getByRole('button', { name: /Max Text/i }));
    expect(document.documentElement.classList.contains('text-size-xlarge')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Dark Mode/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('renders public AboutPage and FeaturesPage with helplines and all 12 platform modules', () => {
    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <AboutPage />
          <FeaturesPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    expect(screen.getByText(/Built around dignity, digital independence/i)).toBeInTheDocument();
    expect(screen.getByText(/112 \(National Emergency\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Everything built for everyday senior confidence/i)).toBeInTheDocument();
    expect(screen.getByText(/Digital Learning Academy/i)).toBeInTheDocument();
    expect(screen.getByText(/AES-256-GCM Backup/i)).toBeInTheDocument();
  });

  it('renders AssistantPage with conversations, suggested prompts, voice controls, and message actions', async () => {
    mockApiFetch.mockImplementation((path: string) => {
      if (path.startsWith('/api/assistant/conversations?')) {
        return Promise.resolve({ conversations: [{ id: 'conv_1', title: 'Morning Chat', language: 'en', updated_at: '2026-01-01' }] });
      }
      if (path === '/api/assistant/conversations') {
        return Promise.resolve({ conversations: [{ id: 'conv_1', title: 'Morning Chat', language: 'en', updated_at: '2026-01-01' }] });
      }
      if (path.includes('/messages')) {
        return Promise.resolve({
          messages: [
            { id: 'm1', role: 'user', content: 'How do I spot a KYC scam?' },
            { id: 'm2', role: 'assistant', content: 'Never share your OTP with anyone.', capability_used: 'safety_scam_detection', verification_note: 'Verified safety reminders.' },
          ],
        });
      }
      return Promise.resolve({ ok: true });
    });

    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <AssistantPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Never share your OTP with anyone/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /New Conversation/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Speak Now/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Read Aloud/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Simplify/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /हिन्दी/i })).toBeInTheDocument();
  });

  it('renders AudioReaderPage with OCR language selector, text editor, and speech controls', () => {
    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <AudioReaderPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    expect(screen.getByLabelText(/Document Language \(OCR\)/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Read Aloud' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Repeat: Off/i })).toBeInTheDocument();

    const editor = screen.getByLabelText(/Edit Extracted Text/i);
    fireEvent.change(editor, { target: { value: 'Take one tablet after breakfast.' } });
    expect(screen.getByRole('button', { name: /Take one tablet after breakfast/i })).toBeInTheDocument();
  });

  it('supports deleting wellness entries in WellnessPage', async () => {
    mockApiFetch.mockImplementation((path: string, opts?: RequestInit) => {
      if (path === '/api/wellness/checkins' && !opts?.method) {
        return Promise.resolve({
          checkins: [
            {
              id: 'wel_1',
              mood: 'good',
              energy_level: 8,
              sleep_hours: 7.5,
              water_glasses: 6,
              activity_done: 'Walk',
              notes: 'Felt energetic',
              sharing_level: 'PRIVATE',
              created_at: '2026-03-01T08:00:00Z',
            },
          ],
          weeklySummary: { entriesCount: 1, avgSleep: 7.5, avgWater: 6, avgEnergy: 8, disclaimer: 'Personal reflection only' },
        });
      }
      return Promise.resolve({ ok: true });
    });

    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <WellnessPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Mood: good/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Delete check-in/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/wellness/checkins/wel_1', { method: 'DELETE' });
    });
  });

  it('supports editing reminders and dismissing due notifications in RemindersPage', async () => {
    mockApiFetch.mockImplementation((path: string, opts?: RequestInit) => {
      if (path === '/api/reminders' && !opts?.method) {
        return Promise.resolve({
          reminders: [
            {
              id: 'rem_1',
              title: 'Morning Walk',
              category: 'exercise',
              schedule_time: '07:00',
              recurring: 'daily',
              timezone: 'Asia/Kolkata',
              completed: 0,
            },
          ],
          notifications: [
            { id: 'ntf_1', title: 'Due Reminder: Morning Walk', body: 'Scheduled for 07:00', scheduled_for: '2026-03-01 07:00', status: 'pending' },
          ],
        });
      }
      return Promise.resolve({ ok: true });
    });

    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <RemindersPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Due Reminder: Morning Walk/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Edit Morning Walk/i }));
    const titleInput = screen.getByLabelText(/Edit reminder title/i);
    fireEvent.change(titleInput, { target: { value: 'Evening Park Walk' } });
    fireEvent.click(screen.getByRole('button', { name: /^Save$/i }));

    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith(
        '/api/reminders/rem_1',
        expect.objectContaining({ method: 'PATCH' })
      );
    });
  });

  it('renders SettingsPage profile and password management forms', async () => {
    mockApiFetch.mockResolvedValue({
      ok: true,
      user: { full_name: 'Asha Deshmukh' },
      profile: { phone: '9876543210', city: 'Pune' },
    });

    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Pune')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Save Profile/i }));
    await waitFor(() => {
      expect(mockApiFetch).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({ method: 'PUT' }));
    });
  });

  it('renders CaregiverDashboard and AdminDashboard with role-scoped privacy notices', async () => {
    mockUser = { ...mockUser, role: 'caregiver' };
    mockApiFetch.mockResolvedValue({
      seniors: [
        {
          connectionId: 'conn_1',
          seniorId: 'sen_1',
          seniorName: 'Mohan Rao',
          relationship: 'Father',
          sharingLevel: 'LIMITED',
          accessNotice: 'LIMITED sharing: private journal notes remain hidden.',
          wellnessSummary: [],
          reminders: [],
          learningStats: { completedLessons: 3, avgQuizScore: 100 },
          emergencyContacts: [],
          notes: [],
        },
      ],
    });

    const { unmount } = render(
      <AccessibilityProvider>
        <MemoryRouter>
          <CaregiverDashboard />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Mohan Rao/i)).toBeInTheDocument();
      expect(screen.getByText(/strictly honors the senior citizen/i)).toBeInTheDocument();
    });
    unmount();

    mockUser = { ...mockUser, role: 'admin' };
    mockApiFetch.mockResolvedValue({
      ok: true,
      privacyNotice: 'Administrator view excludes private senior chat conversations.',
      systemHealth: { database: 'healthy', geminiConfigured: true, uptimeSeconds: 120 },
      stats: { totalUsers: 5, seniors: 3, caregivers: 1, totalScamChecks: 10, totalCourses: 13, totalResearchPapers: 6, totalConsentGrants: 2 },
      users: [],
      courses: [],
      research: [],
      feedback: [],
      auditLogs: [],
    });

    render(
      <AccessibilityProvider>
        <MemoryRouter>
          <AdminDashboard />
        </MemoryRouter>
      </AccessibilityProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Administrator view excludes private senior chat conversations/i)).toBeInTheDocument();
      expect(screen.getByText(/13 \/ 6/)).toBeInTheDocument();
    });
  });
});
