# Security Specification — Firestore Rules (`security_spec.md`)

## 1. Data Invariants
1. Every document ID and foreign ID (`userId`, `convId`, `msgId`, `checkinId`, `reminderId`, `consentId`, `reportId`, `entryId`, `progressId`, `contactId`, `feedbackId`, `caregiverDocId`) must match `^[a-zA-Z0-9_\\-]+$` and have length `<= 128`.
2. Users cannot self-assign `admin` role on `/users/{userId}` creation or escalate `role` during updates. Any valid authenticated user (including public Google Sign-In users) may create their own `/users/{userId}` profile with `uid`, `displayName`, optional `email`/`photoURL`, `role` (`'senior'` or `'caregiver'`), and server timestamps.
3. PII in `/users/{userId}/private/{docId}` and `/elder_profiles/{userId}` is strictly isolated to the owner (`request.auth.uid == userId`) or verified admin; `/users/{userId}` reads are similarly restricted to `isOwner(userId) || isAdmin()`.
4. Subcollection `/conversations/{convId}/messages/{msgId}` enforces the Master Gate `get()` on parent `/conversations/$(convId)` verifying ownership; `/chat_history/{entryId}` is strictly owner-only with `allow update: if false`.
5. Terminal consent states (`rejected`, `revoked`) in `/consentRecords/{consentId}` and `revoked` links in `/caregivers/{caregiverDocId}` cannot be flipped back to `approved`/`active` by unauthorized actors (terminal state lock, overridable only by `isAdmin()`).
6. All `createdAt` / `updatedAt` timestamps must match `request.time`.
7. All `allow list` rules explicitly enforce owner or verified email ownership (e.g. `resource.data.userId == request.auth.uid` or `resource.data.caregiverEmail == request.auth.token.email` for `/caregivers`) with no `get()`/`exists()` inside `allow list`.
8. `/learning_progress`, `/emergency_contacts`, `/feedback`, `/wellness_checkins`, and `/scam_reports` enforce `userId == request.auth.uid`, strict enum/range bounds, and verified email (`email_verified == true`).

## 2. The "Dirty Dozen" Adversarial Payloads (Expected: `PERMISSION_DENIED`)
1. **Self-Admin Escalation on Create**: `POST /users/u1` with `{ uid: "u1", role: "admin", ... }` -> DENIED (`role` restricted to `'senior'` or `'caregiver'` on client create).
2. **Ghost Field Shadow Update**: `PATCH /users/u1` with `{ displayName: "A", isVerifiedAdmin: true, updatedAt: request.time }` -> DENIED by `affectedKeys().hasOnly(...)` & `keys().hasOnly(...)`.
3. **Unverified Email Spoofing**: Request with `email: "omkarsathe3103@gmail.com"` and `email_verified: false` -> DENIED (`email_verified == true` mandated).
4. **PII Cross-User Read**: User `u2` reading `/users/u1/private/info` -> DENIED (`isOwner(u1)` fails).
5. **Blanket List Scraping**: `list /wellnessCheckins` without `where("userId", "==", uid)` -> DENIED (`resource.data.userId == request.auth.uid` enforced).
6. **ID Poisoning**: Document ID of 500 characters or containing `/` / `$` -> DENIED by `isValidId()`.
7. **Timestamp Forgery**: Create `/reminders/r1` with client-supplied past timestamp `createdAt` != `request.time` -> DENIED.
8. **Immutable Owner Tamper**: Update `/reminders/r1` attempting to change `userId` to `u2` -> DENIED (`incoming().userId == existing().userId`).
9. **Orphan Message Injection**: Create `/conversations/otherConv/messages/m1` where `otherConv` belongs to `u2` -> DENIED by Master Gate `get()` on parent conversation.
10. **Terminal State Bypass**: Update `/consentRecords/c1` from `status: "revoked"` back to `status: "approved"` -> DENIED by terminal state lock.
11. **Oversized Payload (Denial of Wallet)**: Create `/conversations/c1/messages/m1` with `content` length `100000` -> DENIED (`content.size() <= 10000`).
12. **Client Admin Collection Tamper**: Client attempting `setDoc` on `/admins/u1` -> DENIED (`allow write: if false`).
