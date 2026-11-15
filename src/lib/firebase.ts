import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail as fbSendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import bundledFirebaseConfig from '../../firebase-applet-config.json';

function readViteEnv(name: string): string {
  try {
    const val = (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.[name];
    return typeof val === 'string' ? val.trim() : '';
  } catch {
    return '';
  }
}

export const resolvedFirebaseConfig = {
  apiKey: readViteEnv('VITE_FIREBASE_API_KEY') || bundledFirebaseConfig.apiKey,
  authDomain: readViteEnv('VITE_FIREBASE_AUTH_DOMAIN') || bundledFirebaseConfig.authDomain,
  projectId: readViteEnv('VITE_FIREBASE_PROJECT_ID') || bundledFirebaseConfig.projectId,
  storageBucket: readViteEnv('VITE_FIREBASE_STORAGE_BUCKET') || bundledFirebaseConfig.storageBucket,
  messagingSenderId:
    readViteEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || bundledFirebaseConfig.messagingSenderId,
  appId: readViteEnv('VITE_FIREBASE_APP_ID') || bundledFirebaseConfig.appId,
  firestoreDatabaseId:
    readViteEnv('VITE_FIREBASE_FIRESTORE_DATABASE_ID') || bundledFirebaseConfig.firestoreDatabaseId,
};

const app = getApps().length ? getApp() : initializeApp(resolvedFirebaseConfig);
export const db = getFirestore(app, resolvedFirebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
googleProvider.setCustomParameters({ prompt: 'select_account' });

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}

export function formatFirebaseAuthError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';
  const rawMessage = error instanceof Error ? error.message : String(error || '');

  switch (code) {
    case 'auth/unauthorized-domain': {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      return `Sign-in domain "${host}" is not authorized in Firebase Console yet. Ask your administrator to add "${host}" under Authentication -> Settings -> Authorized domains.`;
    }
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Continuing with full-page redirect...';
    case 'auth/operation-not-supported-in-this-environment':
      return 'Popup sign-in is not supported in this browser environment. Continuing with full-page redirect...';
    case 'auth/popup-closed-by-user':
      return 'Google Sign-In popup was closed before completing sign-in. Please try again.';
    case 'auth/cancelled-popup-request':
      return 'A previous sign-in window is already open. Please complete or close it and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using another sign-in method. Sign in with that method first.';
    case 'auth/credential-already-in-use':
      return 'This Google credential is already linked to another account.';
    case 'auth/operation-not-allowed':
      return 'This sign-in method is not enabled in Firebase Authentication yet. Enable Google and Email/Password providers in Firebase Console.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please use Sign In instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Please choose a stronger password with at least 8 characters.';
    case 'auth/user-disabled':
      return 'This account has been disabled by an administrator.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please check your details or use Reset Password.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/network-request-failed':
      return 'Network error while connecting to authentication service. Check your internet connection and retry.';
    default:
      if (rawMessage.includes('auth/unauthorized-domain')) {
        const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
        return `Domain "${host}" is not authorized in Firebase Authentication Settings.`;
      }
      return rawMessage || 'Authentication failed. Please try again.';
  }
}

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
  if (typeof window === 'undefined' || typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') {
    return;
  }
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInWithGooglePopup(pendingRole: 'senior' | 'caregiver' = 'senior') {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return { user: result.user, idToken, redirected: false as const };
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    if (
      code === 'auth/popup-blocked' ||
      code === 'auth/operation-not-supported-in-this-environment'
    ) {
      try {
        window.sessionStorage?.setItem('buddy_pending_google_role', pendingRole);
      } catch {
        // ignore storage errors
      }
      await signInWithRedirect(auth, googleProvider);
      return { user: null, idToken: null, redirected: true as const };
    }
    throw new Error(formatFirebaseAuthError(err));
  }
}

export async function consumeGoogleRedirectResult() {
  try {
    const result = await getRedirectResult(auth);
    if (!result?.user) return null;
    const idToken = await result.user.getIdToken();
    let role: 'senior' | 'caregiver' = 'senior';
    try {
      const saved = window.sessionStorage?.getItem('buddy_pending_google_role');
      if (saved === 'caregiver' || saved === 'senior') role = saved;
      window.sessionStorage?.removeItem('buddy_pending_google_role');
    } catch {
      // ignore
    }
    return { user: result.user, idToken, role };
  } catch (err) {
    throw new Error(formatFirebaseAuthError(err));
  }
}

export async function registerWithFirebaseEmail(
  email: string,
  password: string,
  displayName: string
) {
  try {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 100) }).catch(() => {});
    }
    await sendEmailVerification(cred.user).catch(() => {});
    const idToken = await cred.user.getIdToken();
    return { user: cred.user, idToken };
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    const wrapped = new Error(formatFirebaseAuthError(err)) as Error & { code?: string };
    wrapped.code = code;
    throw wrapped;
  }
}

export async function signInWithFirebaseEmail(email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
    const idToken = await cred.user.getIdToken();
    return { user: cred.user, idToken };
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    const wrapped = new Error(formatFirebaseAuthError(err)) as Error & { code?: string };
    wrapped.code = code;
    throw wrapped;
  }
}

export async function sendFirebasePasswordReset(email: string) {
  try {
    await fbSendPasswordResetEmail(auth, email.trim());
    return { sent: true as const };
  } catch (err) {
    const code =
      typeof err === 'object' && err !== null && 'code' in err
        ? String((err as { code?: unknown }).code || '')
        : '';
    return { sent: false as const, code, message: formatFirebaseAuthError(err) };
  }
}

export async function signOutFirebase() {
  if (auth.currentUser) {
    await fbSignOut(auth);
  }
}

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128) || 'item';
}

export function buildUserProfileSyncPayload(params: {
  uid: string;
  isExisting: boolean;
  displayName: string;
  role: 'senior' | 'caregiver' | 'admin';
  preferredLanguage: 'en' | 'hi' | 'mr';
  textSize: 'normal' | 'large' | 'xlarge';
  theme: 'light' | 'dark';
  email?: string;
  photoURL?: string;
}) {
  const uid = sanitizeId(params.uid);
  const resolvedEmail = (params.email || '').trim().toLowerCase().slice(0, 200);
  const resolvedPhotoUrl = (params.photoURL || '').trim().slice(0, 500);
  const resolvedDisplayName = (params.displayName || 'Buddy User').trim().slice(0, 100);
  const safeCreateRole: 'senior' | 'caregiver' =
    params.role === 'caregiver' ? 'caregiver' : 'senior';

  if (!params.isExisting) {
    return {
      uid,
      displayName: resolvedDisplayName,
      ...(resolvedEmail ? { email: resolvedEmail } : {}),
      ...(resolvedPhotoUrl ? { photoURL: resolvedPhotoUrl } : {}),
      role: safeCreateRole,
      preferredLanguage: params.preferredLanguage,
      textSize: params.textSize,
      theme: params.theme,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  }

  return {
    displayName: resolvedDisplayName,
    ...(resolvedEmail ? { email: resolvedEmail } : {}),
    ...(resolvedPhotoUrl ? { photoURL: resolvedPhotoUrl } : {}),
    preferredLanguage: params.preferredLanguage,
    textSize: params.textSize,
    theme: params.theme,
    updatedAt: serverTimestamp(),
  };
}

export async function syncUserProfileToFirestore(params: {
  displayName: string;
  role: 'senior' | 'caregiver' | 'admin';
  preferredLanguage: 'en' | 'hi' | 'mr';
  textSize: 'normal' | 'large' | 'xlarge';
  theme: 'light' | 'dark';
  email?: string;
  photoURL?: string;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const uid = sanitizeId(user.uid);
  const userRef = doc(db, 'users', uid);
  const profilePath = `users/${uid}`;
  const resolvedEmail = (params.email || user.email || '').trim().toLowerCase().slice(0, 200);
  const resolvedPhotoUrl = (params.photoURL ?? user.photoURL ?? '').trim().slice(0, 500);
  const resolvedDisplayName = (params.displayName || user.displayName || 'Buddy User').trim().slice(0, 100);

  try {
    const existingSnap = await getDoc(userRef);
    const payload = buildUserProfileSyncPayload({
      uid,
      isExisting: existingSnap.exists(),
      displayName: resolvedDisplayName,
      role: params.role,
      preferredLanguage: params.preferredLanguage,
      textSize: params.textSize,
      theme: params.theme,
      email: resolvedEmail,
      photoURL: resolvedPhotoUrl,
    });
    if (!existingSnap.exists()) {
      await setDoc(userRef, payload);
    } else {
      await setDoc(userRef, payload, { merge: true });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, profilePath);
  }

  if (resolvedEmail) {
    const privatePath = `users/${uid}/private/info`;
    try {
      await setDoc(
        doc(db, 'users', uid, 'private', 'info'),
        {
          uid,
          email: resolvedEmail,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, privatePath);
    }
  }
}

export async function syncElderProfileToFirestore(params: {
  fullName: string;
  preferredLanguage: 'en' | 'hi' | 'mr';
  city?: string;
  phone?: string;
  bloodGroup?: string;
  allergies?: string;
  emergencyNotes?: string;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const uid = sanitizeId(user.uid);
  const elderRef = doc(db, 'elder_profiles', uid);
  const path = `elder_profiles/${uid}`;
  const optionalFields: Record<string, string> = {};
  if (params.city) optionalFields.city = params.city.slice(0, 100);
  if (params.phone) optionalFields.phone = params.phone.slice(0, 40);
  if (params.bloodGroup) optionalFields.bloodGroup = params.bloodGroup.slice(0, 16);
  if (params.allergies) optionalFields.allergies = params.allergies.slice(0, 300);
  if (params.emergencyNotes) optionalFields.emergencyNotes = params.emergencyNotes.slice(0, 500);

  try {
    const existingSnap = await getDoc(elderRef);
    if (!existingSnap.exists()) {
      await setDoc(elderRef, {
        uid,
        fullName: params.fullName.slice(0, 100) || 'Buddy User',
        preferredLanguage: params.preferredLanguage,
        ...optionalFields,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(
        elderRef,
        {
          fullName: params.fullName.slice(0, 100) || 'Buddy User',
          preferredLanguage: params.preferredLanguage,
          ...optionalFields,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncCaregiverLinkToFirestore(link: {
  id: string;
  caregiverEmail: string;
  relationship: string;
  sharingLevel: 'PRIVATE' | 'LIMITED' | 'AUTHORIZED';
  status: 'pending' | 'active' | 'revoked';
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const docId = sanitizeId(link.id);
  const path = `caregivers/${docId}`;
  try {
    await setDoc(doc(db, 'caregivers', docId), {
      id: docId,
      userId: sanitizeId(user.uid),
      caregiverEmail: link.caregiverEmail.trim().toLowerCase().slice(0, 200),
      relationship: link.relationship.slice(0, 80) || 'Family Caregiver',
      sharingLevel: link.sharingLevel,
      status: link.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncChatHistoryEntryToFirestore(entry: {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  capabilityUsed?: string;
  language: 'en' | 'hi' | 'mr';
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !entry.content.trim()) return;

  const entryId = sanitizeId(entry.id);
  const path = `chat_history/${entryId}`;
  try {
    await setDoc(doc(db, 'chat_history', entryId), {
      id: entryId,
      userId: sanitizeId(user.uid),
      conversationId: sanitizeId(entry.conversationId),
      role: entry.role,
      content: entry.content.slice(0, 10000),
      ...(entry.capabilityUsed ? { capabilityUsed: entry.capabilityUsed.slice(0, 80) } : {}),
      language: entry.language,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncLearningProgressToFirestore(progress: {
  courseId: string;
  lessonId?: string;
  completed: boolean;
  bookmarked: boolean;
  quizScore?: number;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const uid = sanitizeId(user.uid);
  const progressId = sanitizeId(
    progress.lessonId ? `${uid}_${progress.courseId}_${progress.lessonId}` : `${uid}_${progress.courseId}`
  );
  const path = `learning_progress/${progressId}`;
  try {
    await setDoc(
      doc(db, 'learning_progress', progressId),
      {
        id: progressId,
        userId: uid,
        courseId: sanitizeId(progress.courseId),
        ...(progress.lessonId ? { lessonId: progress.lessonId.slice(0, 128) } : {}),
        completed: Boolean(progress.completed),
        bookmarked: Boolean(progress.bookmarked),
        ...(typeof progress.quizScore === 'number'
          ? { quizScore: Math.max(0, Math.min(100, Math.round(progress.quizScore))) }
          : {}),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncEmergencyContactToFirestore(contact: {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const contactId = sanitizeId(contact.id);
  const path = `emergency_contacts/${contactId}`;
  try {
    await setDoc(doc(db, 'emergency_contacts', contactId), {
      id: contactId,
      userId: sanitizeId(user.uid),
      name: contact.name.slice(0, 100) || 'Trusted Contact',
      phone: contact.phone.slice(0, 40),
      relationship: contact.relationship.slice(0, 80) || 'Family',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
  }
}

export async function syncFeedbackToFirestore(entry: {
  id: string;
  category: 'suggestion' | 'accessibility' | 'bug' | 'praise';
  rating: number;
  message: string;
}) {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) return;

  const feedbackId = sanitizeId(entry.id);
  const path = `feedback/${feedbackId}`;
  try {
    await setDoc(doc(db, 'feedback', feedbackId), {
      id: feedbackId,
      userId: sanitizeId(user.uid),
      category: entry.category,
      rating: Math.max(1, Math.min(5, Math.round(entry.rating))),
      message: entry.message.slice(0, 1000),
      status: 'new',
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, path);
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
  const payload = {
    id: checkinId,
    userId: sanitizeId(user.uid),
    mood: entry.mood,
    energyLevel: Math.max(1, Math.min(10, Math.round(entry.energyLevel))),
    sleepHours: Math.max(0, Math.min(24, entry.sleepHours)),
    waterGlasses: Math.max(0, Math.min(30, Math.round(entry.waterGlasses))),
    notes: (entry.notes || '').slice(0, 500),
    sharingLevel: entry.sharingLevel,
    createdAt: serverTimestamp(),
  };

  try {
    await Promise.all([
      setDoc(doc(db, 'wellness_checkins', checkinId), payload),
      setDoc(doc(db, 'wellnessCheckins', checkinId), payload),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `wellness_checkins/${checkinId}`);
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
  const payload = {
    id: reportId,
    userId: sanitizeId(user.uid),
    channel: report.channel,
    riskLevel: report.riskLevel,
    riskScore: Math.max(0, Math.min(100, Math.round(report.riskScore))),
    summary: report.summary.slice(0, 500) || 'No obvious red flags detected.',
    createdAt: serverTimestamp(),
  };

  try {
    await Promise.all([
      setDoc(doc(db, 'scam_reports', reportId), payload),
      setDoc(doc(db, 'scamReports', reportId), payload),
    ]);
  } catch (err) {
    handleFirestoreError(err, OperationType.CREATE, `scam_reports/${reportId}`);
  }
}
