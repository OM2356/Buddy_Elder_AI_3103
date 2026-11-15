import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGooglePopup() {
  const result = await signInWithPopup(auth, googleProvider);
  const idToken = await result.user.getIdToken();
  return { user: result.user, idToken };
}

export async function signOutFirebase() {
  if (auth.currentUser) {
    await fbSignOut(auth);
  }
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
}

export async function syncUserProfileToFirestore(params: {
  displayName: string;
  role: 'senior' | 'caregiver' | 'admin';
  preferredLanguage: 'en' | 'hi' | 'mr';
  textSize: 'normal' | 'large' | 'xlarge';
  theme: 'light' | 'dark';
  email?: string;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const uid = sanitizeId(user.uid);
  const profilePath = `users/${uid}`;
  try {
    await setDoc(
      doc(db, 'users', uid),
      {
        uid,
        displayName: params.displayName.slice(0, 100) || 'Buddy User',
        role: params.role === 'admin' ? 'senior' : params.role,
        preferredLanguage: params.preferredLanguage,
        textSize: params.textSize,
        theme: params.theme,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: false }
    );
  } catch (err) {
    // Profile may already exist; attempt targeted update if permission allows
    try {
      await setDoc(
        doc(db, 'users', uid),
        {
          displayName: params.displayName.slice(0, 100) || 'Buddy User',
          preferredLanguage: params.preferredLanguage,
          textSize: params.textSize,
          theme: params.theme,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      handleFirestoreError(err, OperationType.WRITE, profilePath);
    }
  }

  if (params.email) {
    const privatePath = `users/${uid}/private/info`;
    try {
      await setDoc(doc(db, 'users', uid, 'private', 'info'), {
        uid,
        email: params.email.slice(0, 200),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, privatePath);
    }
  }
}

export async function syncWellnessToFirestore(entry: {
  id: string;
  mood: 'great' | 'good' | 'okay' | 'low' | 'stressed';
  energyLevel: number;
  sleepHours: number;
  waterGlasses: number;
  notes?: string;
  sharingLevel: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const checkinId = sanitizeId(entry.id);
  const path = `wellnessCheckins/${checkinId}`;
  try {
    await setDoc(doc(db, 'wellnessCheckins', checkinId), {
      id: checkinId,
      userId: sanitizeId(user.uid),
      mood: entry.mood,
      energyLevel: Math.max(1, Math.min(10, Math.round(entry.energyLevel))),
      sleepHours: Math.max(0, Math.min(24, entry.sleepHours)),
      waterGlasses: Math.max(0, Math.min(30, Math.round(entry.waterGlasses))),
      notes: (entry.notes || '').slice(0, 500),
      sharingLevel: entry.sharingLevel,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncReminderToFirestore(reminder: {
  id: string;
  title: string;
  category: 'medication' | 'water' | 'exercise' | 'appointment' | 'learning' | 'family' | 'custom';
  scheduleTime: string;
  recurring: 'none' | 'daily' | 'weekly';
  completed: boolean;
  timezone: string;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const reminderId = sanitizeId(reminder.id);
  const path = `reminders/${reminderId}`;
  try {
    await setDoc(doc(db, 'reminders', reminderId), {
      id: reminderId,
      userId: sanitizeId(user.uid),
      title: reminder.title.slice(0, 160),
      category: reminder.category,
      scheduleTime: reminder.scheduleTime.slice(0, 40),
      recurring: reminder.recurring,
      completed: reminder.completed,
      timezone: reminder.timezone.slice(0, 64),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncScamReportToFirestore(report: {
  id: string;
  channel: 'sms' | 'whatsapp' | 'email' | 'url' | 'payment' | 'phone';
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  riskScore: number;
  summary: string;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const reportId = sanitizeId(report.id);
  const path = `scamReports/${reportId}`;
  try {
    await setDoc(doc(db, 'scamReports', reportId), {
      id: reportId,
      userId: sanitizeId(user.uid),
      channel: report.channel,
      riskLevel: report.riskLevel,
      riskScore: Math.max(0, Math.min(100, Math.round(report.riskScore))),
      summary: report.summary.slice(0, 500),
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}
