import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let resend = null;
async function client() {
  if (resend) return resend;
  const { Resend } = await import('resend');
  resend = new Resend(env.email.resendApiKey);
  return resend;
}

export function emailIsLive() {
  return !env.mockProviders && Boolean(env.email.resendApiKey);
}

async function send({ to, subject, html }) {
  if (!emailIsLive()) {
    logger.info('[MOCK] email.send', { to, subject });
    return { id: `mock_email_${Date.now()}`, mocked: true };
  }
  const res = await client().emails.send({
    from: env.email.from,
    to,
    subject,
    html,
  });
  return res;
}

const wrap = (title, body) => `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
    <h2 style="color:#0b5cff">${title}</h2>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
    <p style="font-size:12px;color:#888">SiteRing — AI reception for UK trades. This is an automated message.</p>
  </div>`;

/**
 * Initial onboarding email — fires right after /api/onboard completes.
 */
export async function sendOnboardingReceived({ to, businessName, telnyxNumber }) {
  const html = wrap(
    'Onboarding received — pending activation',
    `<p>Hi ${businessName},</p>
     <p>Thanks for signing up. We've received your compliance documents and reserved your
     local business number:</p>
     <p style="font-size:22px;font-weight:bold">${telnyxNumber}</p>
     <p>Your account status is <strong>Pending Regulatory Approval</strong>. Ofcom regulatory
     checks (via Telnyx) usually complete within 1–2 business days. We'll email you the moment
     your AI line is live.</p>`,
  );
  return send({ to, subject: 'Onboarding received — pending activation', html });
}

/**
 * Activation email — fires when Telnyx regulatory approval passes.
 */
export async function sendActivation({ to, businessName, telnyxNumber }) {
  const html = wrap(
    'Your AI line is 100% live 🎉',
    `<p>Hi ${businessName},</p>
     <p>Great news — regulatory approval is complete and your AI receptionist is now
     <strong>live</strong> on:</p>
     <p style="font-size:22px;font-weight:bold">${telnyxNumber}</p>
     <p>Every call is answered, recorded, transcribed and summarised in your dashboard.
     Give it a test call to hear your greeting in action.</p>`,
  );
  return send({ to, subject: 'Your AI line is now live', html });
}

/**
 * Call lead alert — fires when an inbound call produces an actionable lead.
 */
export async function sendLeadAlert({ to, businessName, callerNumber, summary, recordingUrl }) {
  const html = wrap(
    'New lead from your AI line',
    `<p>Hi ${businessName},</p>
     <p>You just received a call that looks like an actionable lead.</p>
     <p><strong>Caller:</strong> ${callerNumber}</p>
     <p><strong>Summary:</strong><br/>${summary || 'See dashboard for details.'}</p>
     ${recordingUrl ? `<p><a href="${recordingUrl}">Listen to the recording</a></p>` : ''}`,
  );
  return send({ to, subject: `New lead from ${callerNumber}`, html });
}
