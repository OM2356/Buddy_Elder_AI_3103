import { describe, expect, it, beforeEach } from 'vitest';
import request from 'supertest';
import type Database from 'better-sqlite3';
import { createDatabase } from '../server/db/database.ts';
import { createApp } from '../server/app.ts';
import { orchestrator } from '../server/services/orchestrator.ts';
import { decryptBackupData, encryptBackupData } from '../server/services/backup.ts';

describe('Buddy Elder AI Full-Stack API, Security & Business Logic', () => {
  let db: Database.Database;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    db = createDatabase(':memory:');
    app = createApp(db);
  });

  it('serves healthy status and seeds 13 Academy courses and 6 Research papers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.database).toBe('connected');

    const coursesCount = (db.prepare('SELECT COUNT(*) as c FROM courses').get() as { c: number }).c;
    const papersCount = (db.prepare('SELECT COUNT(*) as c FROM research_documents').get() as { c: number }).c;
    expect(coursesCount).toBe(13);
    expect(papersCount).toBe(6);
  });

  it('registers with bcryptjs, rejects wrong passwords, issues JWT, and blocks unauthorized access', async () => {
    const unauth = await request(app).get('/api/auth/me');
    expect(unauth.status).toBe(401);

    const reg = await request(app).post('/api/auth/register').send({
      email: 'senior1@example.com',
      password: 'StrongPassword123!',
      fullName: 'Asha Deshmukh',
      role: 'senior',
      preferredLanguage: 'mr',
    });
    expect(reg.status).toBe(201);
    expect(reg.body.user.role).toBe('senior');
    expect(reg.body.token).toBeTruthy();

    // Ensure password is hashed in DB, not plaintext
    const dbUser = db.prepare('SELECT password_hash FROM users WHERE email = ?').get('senior1@example.com') as {
      password_hash: string;
    };
    expect(dbUser.password_hash).not.toBe('StrongPassword123!');
    expect(dbUser.password_hash.startsWith('$2')).toBe(true);

    // Duplicate email rejected
    const dup = await request(app).post('/api/auth/register').send({
      email: 'senior1@example.com',
      password: 'StrongPassword123!',
      fullName: 'Duplicate',
      role: 'senior',
    });
    expect(dup.status).toBe(409);

    // Wrong password rejected
    const badLogin = await request(app).post('/api/auth/login').send({
      email: 'senior1@example.com',
      password: 'WrongPassword',
    });
    expect(badLogin.status).toBe(401);

    // Senior cannot access Admin or Caregiver endpoints
    const forbiddenAdmin = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(forbiddenAdmin.status).toBe(403);

    const forbiddenCaregiver = await request(app)
      .get('/api/caregiver/seniors')
      .set('Authorization', `Bearer ${reg.body.token}`);
    expect(forbiddenCaregiver.status).toBe(403);
  });

  it('enforces Caregiver privacy via Autonomy Engine (PRIVATE vs LIMITED vs AUTHORIZED & revocation)', async () => {
    const seniorReg = await request(app).post('/api/auth/register').send({
      email: 'senior.autonomy@example.com',
      password: 'Password123!',
      fullName: 'Mohan Rao',
      role: 'senior',
    });
    const seniorToken = seniorReg.body.token;

    const caregiverReg = await request(app).post('/api/auth/register').send({
      email: 'caregiver.autonomy@example.com',
      password: 'Password123!',
      fullName: 'Priya Rao',
      role: 'caregiver',
    });
    const caregiverToken = caregiverReg.body.token;

    // Senior logs a PRIVATE wellness check-in and an AUTHORIZED one
    await request(app)
      .post('/api/wellness/checkins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        mood: 'low',
        energyLevel: 4,
        sleepHours: 5,
        waterGlasses: 3,
        notes: 'Secret private journal note',
        sharingLevel: 'PRIVATE',
      });

    await request(app)
      .post('/api/wellness/checkins')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        mood: 'good',
        energyLevel: 8,
        sleepHours: 7.5,
        waterGlasses: 7,
        notes: 'Shared morning walk note',
        sharingLevel: 'AUTHORIZED',
      });

    // Invite caregiver with LIMITED sharing
    const invite = await request(app)
      .post('/api/family/invite')
      .set('Authorization', `Bearer ${seniorToken}`)
      .send({
        inviteeEmail: 'caregiver.autonomy@example.com',
        relationship: 'Daughter',
        proposedSharingLevel: 'LIMITED',
      });
    expect(invite.status).toBe(201);

    // Caregiver accepts invite
    const accept = await request(app)
      .post(`/api/family/invitations/${invite.body.invitation.id}/respond`)
      .set('Authorization', `Bearer ${caregiverToken}`)
      .send({ decision: 'accept' });
    expect(accept.status).toBe(200);

    // Caregiver sees only non-private checkins, and LIMITED hides personal notes!
    const cgView = await request(app)
      .get('/api/caregiver/seniors')
      .set('Authorization', `Bearer ${caregiverToken}`);
    expect(cgView.status).toBe(200);
    expect(cgView.body.seniors).toHaveLength(1);
    const wellnessSeen = cgView.body.seniors[0].wellnessSummary;
    expect(wellnessSeen).toHaveLength(1);
    expect(wellnessSeen[0].mood).toBe('good');
    expect(wellnessSeen[0].notes).toBeUndefined();

    // Senior revokes connection -> Caregiver immediately loses access
    const famOverview = await request(app)
      .get('/api/family/overview')
      .set('Authorization', `Bearer ${seniorToken}`);
    const connId = famOverview.body.connections[0].id;

    await request(app)
      .delete(`/api/family/connections/${connId}`)
      .set('Authorization', `Bearer ${seniorToken}`);

    const cgViewAfter = await request(app)
      .get('/api/caregiver/seniors')
      .set('Authorization', `Bearer ${caregiverToken}`);
    expect(cgViewAfter.body.seniors).toHaveLength(0);
  });

  it('detects OTP, UPI PIN QR receive, KYC, and AnyDesk scams deterministically', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'scamcheck@example.com',
      password: 'Password123!',
      fullName: 'Test Senior',
      role: 'senior',
    });
    const token = reg.body.token;

    const highRisk = await request(app)
      .post('/api/scam/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'sms',
        content: 'URGENT: KYC blocked! Install AnyDesk and enter UPI PIN to receive Rs 5000 refund via http://bit.ly/fake123',
        includeAiExplanation: false,
      });
    expect(highRisk.status).toBe(200);
    expect(highRisk.body.riskLevel).toBe('HIGH');
    expect(highRisk.body.riskScore).toBeGreaterThanOrEqual(55);
    expect(highRisk.body.cybercrimeHelp.helpline).toContain('1930');

    const lowRisk = await request(app)
      .post('/api/scam/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({
        channel: 'whatsapp',
        content: 'Good morning Maa, reaching home at 6 PM for dinner.',
        includeAiExplanation: false,
      });
    expect(lowRisk.status).toBe(200);
    expect(lowRisk.body.riskLevel).toBe('LOW');
    expect(lowRisk.body.cybercrimeHelp.disclaimer).toContain('cannot guarantee');
  });

  it('routes AI intents cleanly across BuddyAgentOrchestrator capabilities', () => {
    expect(orchestrator.classifyIntent('Someone asked for my UPI PIN on AnyDesk', 'senior')).toBe('safety_scam_detection');
    expect(orchestrator.classifyIntent('I need ambulance 108 emergency help', 'senior')).toBe('emergency_sos');
    expect(orchestrator.classifyIntent('How do I increase font size on WhatsApp?', 'senior')).toBe('digital_education');
    expect(orchestrator.classifyIntent('How much sleep and water should I track for wellness?', 'senior')).toBe('wellness_ageing');
    expect(orchestrator.classifyIntent('What does the WHO research study say?', 'senior')).toBe('knowledge_hub_rag');
    expect(orchestrator.classifyIntent('Namaste, tell me a cheerful morning thought', 'senior')).toBe('companion');
  });

  it('handles Academy progress, Research RAG fallback, Reminders, Emergency double-confirm, and AES-256-GCM Backup/Restore', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'fullflow@example.com',
      password: 'Password123!',
      fullName: 'Kiran Joshi',
      role: 'senior',
    });
    const token = reg.body.token;

    // Academy progress & quiz
    const courses = await request(app).get('/api/academy/courses').set('Authorization', `Bearer ${token}`);
    expect(courses.body.courses.length).toBe(13);

    const quizRes = await request(app)
      .post('/api/academy/quiz')
      .set('Authorization', `Bearer ${token}`)
      .send({ courseId: 'course_upi_safety', answers: { quiz_upi_1: 1 } });
    expect(quizRes.status).toBe(200);
    expect(quizRes.body.score).toBe(100);

    // Research Hub grounded answer
    const researchAsk = await request(app)
      .post('/api/research/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentId: 'paper_rbi_be_aware_fraud',
        question: 'What does RBI say about QR codes?',
        language: 'en',
      });
    expect(researchAsk.status).toBe(200);
    expect(researchAsk.body.citation.title).toContain('BE(A)WARE');

    // Reminders CRUD
    const remCreate = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Evening Walk',
        category: 'exercise',
        scheduleTime: '17:30',
        recurring: 'daily',
        timezone: 'Asia/Kolkata',
      });
    expect(remCreate.status).toBe(201);

    // Emergency double-confirmation guard
    const sosDenied = await request(app)
      .post('/api/emergency/sos-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmedDoubleCheck: false,
        shareLocationPermitted: false,
        selectedService: '112',
      });
    expect(sosDenied.status).toBe(400);

    const sosOk = await request(app)
      .post('/api/emergency/sos-log')
      .set('Authorization', `Bearer ${token}`)
      .send({
        confirmedDoubleCheck: true,
        shareLocationPermitted: false,
        selectedService: '112',
      });
    expect(sosOk.status).toBe(200);

    // Backup requires consent
    const bakDenied = await request(app)
      .post('/api/backup/export')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(bakDenied.status).toBe(403);

    const bakExport = await request(app)
      .post('/api/backup/export')
      .set('Authorization', `Bearer ${token}`)
      .send({ explicitConsent: true });
    expect(bakExport.status).toBe(200);
    expect(bakExport.body.envelope.algorithm).toBe('AES-256-GCM');

    // Tamper test on AES-256-GCM envelope
    const tampered = { ...bakExport.body.envelope, authTag: Buffer.alloc(16, 1).toString('base64') };
    const restoreTampered = await request(app)
      .post('/api/backup/restore')
      .set('Authorization', `Bearer ${token}`)
      .send({ envelope: tampered });
    expect(restoreTampered.status).toBe(400);

    // Valid restore succeeds
    const restoreOk = await request(app)
      .post('/api/backup/restore')
      .set('Authorization', `Bearer ${token}`)
      .send({ envelope: bakExport.body.envelope });
    expect(restoreOk.status).toBe(200);
  });

  it('ensures unique random IV per AES-256-GCM encryption', () => {
    const sample = {
      exportedAt: new Date().toISOString(),
      userId: 'u1',
      profile: undefined,
      preferences: undefined,
      wellnessCheckins: [],
      reminders: [],
      trustedContacts: [],
      consentRecords: [],
      conversations: [],
      messages: [],
    };
    const e1 = encryptBackupData(sample);
    const e2 = encryptBackupData(sample);
    expect(e1.iv).not.toBe(e2.iv);
    expect(decryptBackupData(e1).userId).toBe('u1');
  });

  it('allows bootstrapped admin console access without exposing private senior messages', async () => {
    const adminReg = await request(app).post('/api/auth/register').send({
      email: 'omkarsathe3103@gmail.com',
      password: 'AdminPassword123!',
      fullName: 'Omkar Admin',
      role: 'senior',
    });
    expect(adminReg.body.user.role).toBe('admin');

    const overview = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${adminReg.body.token}`);
    expect(overview.status).toBe(200);
    expect(overview.body.privacyNotice).toContain('excludes private senior chat conversations');
    expect(overview.body.messages).toBeUndefined();
  });

  it('supports profile update, password change, and single-use expiring password reset tokens', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'pwd.reset@example.com',
      password: 'InitialPassword1!',
      fullName: 'Suresh Nair',
      role: 'senior',
    });
    const token = reg.body.token;

    // Profile update
    const prof = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'Suresh K. Nair', preferredLanguage: 'hi', city: 'Mumbai' });
    expect(prof.status).toBe(200);
    expect(prof.body.user.full_name).toBe('Suresh K. Nair');
    expect(prof.body.profile.city).toBe('Mumbai');

    // Wrong current password rejected
    const badChange = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'WrongPassword1!', newPassword: 'UpdatedPassword2!' });
    expect(badChange.status).toBe(401);

    // Valid password change
    const okChange = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'InitialPassword1!', newPassword: 'UpdatedPassword2!' });
    expect(okChange.status).toBe(200);

    // Forgot password generates token & reset works once
    const forgot = await request(app).post('/api/auth/forgot-password').send({ email: 'pwd.reset@example.com' });
    expect(forgot.status).toBe(200);
    expect(forgot.body.devResetToken).toBeTruthy();

    const resetOk = await request(app).post('/api/auth/reset-password').send({
      token: forgot.body.devResetToken,
      newPassword: 'ResetPassword3!',
    });
    expect(resetOk.status).toBe(200);

    // Single-use token cannot be reused
    const reuse = await request(app).post('/api/auth/reset-password').send({
      token: forgot.body.devResetToken,
      newPassword: 'AnotherPassword4!',
    });
    expect(reuse.status).toBe(400);

    // Login succeeds with reset password
    const login = await request(app).post('/api/auth/login').send({
      email: 'pwd.reset@example.com',
      password: 'ResetPassword3!',
    });
    expect(login.status).toBe(200);
  });

  it('supports wellness deletion, pagination, and reminder editing with due notification sync', async () => {
    const reg1 = await request(app).post('/api/auth/register').send({
      email: 'wel.del1@example.com',
      password: 'Password123!',
      fullName: 'User One',
      role: 'senior',
    });
    const reg2 = await request(app).post('/api/auth/register').send({
      email: 'wel.del2@example.com',
      password: 'Password123!',
      fullName: 'User Two',
      role: 'senior',
    });

    const created = await request(app)
      .post('/api/wellness/checkins')
      .set('Authorization', `Bearer ${reg1.body.token}`)
      .send({ mood: 'good', energyLevel: 8, sleepHours: 7, waterGlasses: 6, sharingLevel: 'PRIVATE' });
    const checkinId = created.body.checkin.id;

    // Other user cannot delete
    const otherDel = await request(app)
      .delete(`/api/wellness/checkins/${checkinId}`)
      .set('Authorization', `Bearer ${reg2.body.token}`);
    expect(otherDel.status).toBe(404);

    // Owner deletes
    const ownerDel = await request(app)
      .delete(`/api/wellness/checkins/${checkinId}`)
      .set('Authorization', `Bearer ${reg1.body.token}`);
    expect(ownerDel.status).toBe(200);

    // Pagination shape
    const list = await request(app)
      .get('/api/wellness/checkins?limit=5&offset=0')
      .set('Authorization', `Bearer ${reg1.body.token}`);
    expect(list.status).toBe(200);
    expect(list.body.pagination.total).toBe(0);

    // Reminder edit + due notification generation (00:00 is always <= current HH:MM)
    const rem = await request(app)
      .post('/api/reminders')
      .set('Authorization', `Bearer ${reg1.body.token}`)
      .send({
        title: 'Drink Morning Water',
        category: 'water',
        scheduleTime: '00:00',
        recurring: 'daily',
        timezone: 'UTC',
      });
    expect(rem.status).toBe(201);

    const edited = await request(app)
      .patch(`/api/reminders/${rem.body.reminder.id}`)
      .set('Authorization', `Bearer ${reg1.body.token}`)
      .send({ title: 'Drink Warm Water', scheduleTime: '00:01' });
    expect(edited.status).toBe(200);
    expect(edited.body.reminder.title).toBe('Drink Warm Water');

    const getRem = await request(app)
      .get('/api/reminders')
      .set('Authorization', `Bearer ${reg1.body.token}`);
    expect(getRem.status).toBe(200);
    expect(getRem.body.notifications.length).toBeGreaterThanOrEqual(1);

    const dismiss = await request(app)
      .patch(`/api/reminders/notifications/${getRem.body.notifications[0].id}/dismiss`)
      .set('Authorization', `Bearer ${reg1.body.token}`);
    expect(dismiss.status).toBe(200);
  });

  it('indexes uploaded research .txt documents into chunks, retrieves top chunks, and handles invalid files', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      email: 'rag.user@example.com',
      password: 'Password123!',
      fullName: 'Meera Kulkarni',
      role: 'senior',
    });
    const token = reg.body.token;

    // Reject too-short text
    const shortRes = await request(app)
      .post('/api/research/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Too Short')
      .field('textContent', 'Hello');
    expect(shortRes.status).toBe(400);

    // Reject binary/unsupported file extension
    const badFile = await request(app)
      .post('/api/research/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Executable Test')
      .attach('file', Buffer.from('binary payload data with enough bytes to pass length check'), 'malware.exe');
    expect(badFile.status).toBe(400);

    // Valid .txt upload
    const sampleDoc = [
      'Section One: Morning hydration helps maintain steady blood circulation and prevents daytime fatigue in older adults.',
      '',
      'Section Two: Always verify incoming payment QR codes. Never scan a QR code or enter your UPI PIN to receive a refund.',
      '',
      'Section Three: Keep emergency helpline 112 and cyber fraud helpline 1930 written near your home telephone.',
    ].join('\n');

    const uploadOk = await request(app)
      .post('/api/research/upload')
      .set('Authorization', `Bearer ${token}`)
      .field('title', 'Home Safety & Hydration Guide')
      .field('authors', 'Community Health Clinic')
      .field('topic', 'Senior Safety')
      .attach('file', Buffer.from(sampleDoc, 'utf8'), 'safety-guide.txt');

    expect(uploadOk.status).toBe(201);
    expect(uploadOk.body.chunkCount).toBeGreaterThanOrEqual(3);

    const askRes = await request(app)
      .post('/api/research/ask')
      .set('Authorization', `Bearer ${token}`)
      .send({
        documentId: uploadOk.body.document.id,
        question: 'What helpline number should I keep for cyber fraud?',
        language: 'en',
      });
    expect(askRes.status).toBe(200);
    expect(askRes.body.hasLexicalMatch).toBe(true);
    expect(askRes.body.retrievedChunks.length).toBeGreaterThan(0);
    expect(askRes.body.retrievedChunks[0].chunkText).toContain('1930');

    // Cleanly handles owner deletion and blocks deleting seeded WHO paper
    const delSeeded = await request(app)
      .delete('/api/research/paper_who_decade_healthy_ageing')
      .set('Authorization', `Bearer ${token}`);
    expect(delSeeded.status).toBe(403);

    const delOwn = await request(app)
      .delete(`/api/research/${uploadOk.body.document.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(delOwn.status).toBe(200);
  });

  it('truthfully returns 503 error on AI chat when GEMINI_API_KEY is absent instead of fake replies', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const reg = await request(app).post('/api/auth/register').send({
        email: 'no.gemini@example.com',
        password: 'Password123!',
        fullName: 'Offline Test',
        role: 'senior',
      });

      const chat = await request(app)
        .post('/api/assistant/chat')
        .set('Authorization', `Bearer ${reg.body.token}`)
        .send({ message: 'Hello Buddy', language: 'en', stream: false });

      expect(chat.status).toBe(503);
      expect(chat.body.ok).toBe(false);
      expect(chat.body.code).toBe('GEMINI_UNCONFIGURED');
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it('classifies 30 realistic multi-domain prompts across BuddyAgentOrchestrator capabilities', () => {
    const cases: [string, 'senior' | 'caregiver' | 'admin', string][] = [
      ['Someone called asking for my OTP to unblock KYC', 'senior', 'safety_scam_detection'],
      ['Should I scan this QR code on OLX to receive Rs 2000?', 'senior', 'safety_scam_detection'],
      ['A bank caller asked me to install AnyDesk', 'senior', 'safety_scam_detection'],
      ['Is this bit.ly phishing link safe to open?', 'senior', 'safety_scam_detection'],
      ['What is 1930 cybercrime helpline?', 'senior', 'safety_scam_detection'],
      ['Emergency! My neighbor fell down and needs 108 ambulance', 'senior', 'emergency_sos'],
      ['I have severe chest pain, urgent help SOS', 'senior', 'emergency_sos'],
      ['Call 112 police guidance please', 'senior', 'emergency_sos'],
      ['How to use WhatsApp voice messages step by step?', 'senior', 'digital_education'],
      ['Show me a tutorial on how to open Google Maps', 'senior', 'digital_education'],
      ['How do I increase font size on my smartphone?', 'senior', 'digital_education'],
      ['How to join a Zoom video call or YouTube lesson?', 'senior', 'digital_education'],
      ['What is my learning progress and next lesson?', 'senior', 'learning_progress'],
      ['Check my quiz score and completed lesson count', 'senior', 'learning_progress'],
      ['How many glasses of water and hours of sleep for wellness?', 'senior', 'wellness_ageing'],
      ['Track my daily morning walk and exercise routine', 'senior', 'wellness_ageing'],
      ['Remind me about gentle stretches when tired', 'senior', 'wellness_ageing'],
      ['Feeling lonely today, can you talk to me like a friend?', 'senior', 'companion'],
      ['Namaste Buddy, tell me a peaceful morning story', 'senior', 'companion'],
      ['Good morning! How are you doing today?', 'senior', 'companion'],
      ['Translate this safety message into Hindi', 'senior', 'accessibility_speech'],
      ['Make that explanation simpler and shorter to read aloud', 'senior', 'accessibility_speech'],
      ['Convert this guidance to Marathi voice friendly lines', 'senior', 'accessibility_speech'],
      ['What does the WHO healthy ageing research study conclude?', 'senior', 'knowledge_hub_rag'],
      ['Show RBI and CERT-In evidence on digital fraud', 'senior', 'knowledge_hub_rag'],
      ['How can I support my father without invading consent?', 'caregiver', 'caregiver_support'],
      ['Why is my mother senior sharing level marked limited?', 'caregiver', 'caregiver_support'],
      ['Check caregiver summary for my parent', 'caregiver', 'caregiver_support'],
      ['What is the capital of Maharashtra?', 'senior', 'general_conversation'],
      ['Give me ideas for indoor gardening in rainy weather', 'senior', 'general_conversation'],
    ];

    expect(cases).toHaveLength(30);
    for (const [prompt, role, expected] of cases) {
      expect(orchestrator.classifyIntent(prompt, role)).toBe(expected);
    }
  });

  it('links optional firebaseUid on registration and reports emailDeliveryConfigured truthfully on forgot-password', async () => {
    const prevResendKey = process.env.RESEND_API_KEY;
    const prevResendFrom = process.env.RESEND_FROM_EMAIL;
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_FROM_EMAIL;

    try {
      const reg = await request(app).post('/api/auth/register').send({
        email: 'fb.linked@example.com',
        password: 'StrongPassword123!',
        fullName: 'Linked User',
        role: 'senior',
        preferredLanguage: 'en',
        firebaseUid: 'fb_uid_sample_999',
      });
      expect(reg.status).toBe(201);

      const userRow = db
        .prepare('SELECT firebase_uid FROM users WHERE email = ?')
        .get('fb.linked@example.com') as { firebase_uid: string | null };
      expect(userRow.firebase_uid).toBe('fb_uid_sample_999');

      const forgot = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'fb.linked@example.com' });
      expect(forgot.status).toBe(200);
      expect(forgot.body.emailDeliveryConfigured).toBe(false);
    } finally {
      if (prevResendKey !== undefined) process.env.RESEND_API_KEY = prevResendKey;
      if (prevResendFrom !== undefined) process.env.RESEND_FROM_EMAIL = prevResendFrom;
    }
  });

  it('serves /api/health via the Vercel serverless Express adapter', async () => {
    process.env.VERCEL = '1';
    process.env.DATABASE_PATH = ':memory:';
    try {
      const { default: vercelHandler } = await import('../api/index.ts');
      const res = await request(vercelHandler).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
      expect(res.body.database).toBe('connected');
    } finally {
      delete process.env.VERCEL;
      delete process.env.DATABASE_PATH;
    }
  });

  it('allows public non-admin Google/email accounts as senior or caregiver and rejects admin self-escalation', async () => {
    const caregiverReg = await request(app).post('/api/auth/register').send({
      email: 'public.caregiver@gmail.com',
      password: 'StrongPassword123!',
      fullName: 'Public Caregiver',
      role: 'caregiver',
    });
    expect(caregiverReg.status).toBe(201);
    expect(caregiverReg.body.user.role).toBe('caregiver');

    const blockedEscalation = await request(app).post('/api/auth/register').send({
      email: 'attacker@gmail.com',
      password: 'StrongPassword123!',
      fullName: 'Attacker',
      role: 'admin',
    });
    expect(blockedEscalation.status).toBe(400);

    const blockedFirebaseEscalation = await request(app).post('/api/auth/firebase').send({
      idToken: 'x'.repeat(40),
      role: 'admin',
    });
    expect(blockedFirebaseEscalation.status).toBe(400);
  });
});
