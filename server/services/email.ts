import { getEnvConfig } from '../config/env.ts';

export function isEmailDeliveryConfigured(): boolean {
  const { resendApiKey, resendFromEmail } = getEnvConfig();
  return Boolean(resendApiKey && resendFromEmail);
}

export async function sendPasswordResetEmail(params: {
  to: string;
  resetCode: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const { resendApiKey, resendFromEmail, appUrl } = getEnvConfig();
  if (!resendApiKey || !resendFromEmail) {
    return { sent: false, reason: 'RESEND_UNCONFIGURED' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [params.to],
      subject: 'Buddy Elder AI — Password Reset Code',
      text: [
        'Hello from Buddy Elder AI,',
        '',
        'You requested a password reset for your Buddy Elder AI account.',
        `Your single-use reset code (valid for 15 minutes): ${params.resetCode}`,
        '',
        `Open ${appUrl}/login and choose "Reset Password" to enter this code.`,
        'If you did not request this change, you can safely ignore this message.',
      ].join('\n'),
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: `RESEND_HTTP_${response.status}` };
  }
  return { sent: true };
}

export async function sendAdminNotificationEmail(params: {
  subject: string;
  text: string;
}): Promise<{ sent: boolean }> {
  const { resendApiKey, resendFromEmail, adminNotificationEmail } = getEnvConfig();
  if (!resendApiKey || !resendFromEmail || !adminNotificationEmail) {
    return { sent: false };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: resendFromEmail,
        to: [adminNotificationEmail],
        subject: params.subject,
        text: params.text,
      }),
    });
    return { sent: response.ok };
  } catch {
    return { sent: false };
  }
}
