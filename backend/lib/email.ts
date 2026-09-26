// Transactional email via Resend's HTTP API (https://resend.com/docs/api-reference/emails/send-email).
// Without RESEND_API_KEY (local development) emails are logged instead of sent,
// so reset and verification links can be copied from the server console.

const RESEND_API_URL = 'https://api.resend.com/emails';
const APP_NAME = 'mbuffs';

interface EmailMessage {
    to: string;
    subject: string;
    html: string;
    text: string;
}

const escapeHtml = (value: string): string =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export const sendEmail = async ({ to, subject, html, text }: EmailMessage): Promise<void> => {
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.EMAIL_FROM;

    // Tests use fake @example.com addresses; real sends would bounce and hurt
    // the sending domain's reputation.
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    if (!apiKey || !from) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('[email] RESEND_API_KEY and EMAIL_FROM must be set to send email');
        }
        console.info(`[email] (not sent: RESEND_API_KEY/EMAIL_FROM unset) to=${to} subject="${subject}"\n${text}`);
        return;
    }

    const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, html, text }),
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`[email] Resend responded ${response.status}: ${body}`);
    }
};

// One-button layout shared by the auth emails. Inline styles only: most
// email clients strip <style> blocks.
const renderActionEmail = ({ greetingName, intro, actionLabel, url, outro }: {
    greetingName: string | null;
    intro: string;
    actionLabel: string;
    url: string;
    outro: string;
}): { html: string; text: string } => {
    const greeting = greetingName ? `Hi ${greetingName},` : 'Hi,';
    const safeUrl = escapeHtml(url);

    const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;">
      <tr>
        <td style="padding:32px;">
          <p style="margin:0 0 24px;font-size:20px;font-weight:600;">${APP_NAME}</p>
          <p style="margin:0 0 16px;font-size:15px;line-height:1.5;">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 24px;font-size:15px;line-height:1.5;">${escapeHtml(intro)}</p>
          <p style="margin:0 0 24px;">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 20px;background:#18181b;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${escapeHtml(actionLabel)}</a>
          </p>
          <p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:#71717a;">${escapeHtml(outro)}</p>
          <p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;word-break:break-all;">If the button doesn't work, paste this link into your browser:<br>${safeUrl}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

    const text = `${greeting}\n\n${intro}\n\n${actionLabel}: ${url}\n\n${outro}\n`;

    return { html, text };
};

export const sendPasswordResetEmail = (user: { email: string; name?: string | null }, url: string) => {
    const { html, text } = renderActionEmail({
        greetingName: user.name || null,
        intro: `Someone asked to reset the password for your ${APP_NAME} account. Use the button below to choose a new one. The link expires in 1 hour.`,
        actionLabel: 'Reset password',
        url,
        outro: "If you didn't ask for this, you can ignore this email. Your password won't change.",
    });
    return sendEmail({ to: user.email, subject: `Reset your ${APP_NAME} password`, html, text });
};

export const sendVerificationEmail = (user: { email: string; name?: string | null }, url: string) => {
    const { html, text } = renderActionEmail({
        greetingName: user.name || null,
        intro: `Confirm this is your email address to finish setting up your ${APP_NAME} account. The link expires in 1 hour.`,
        actionLabel: 'Verify email',
        url,
        outro: `If you didn't create a ${APP_NAME} account, you can ignore this email.`,
    });
    return sendEmail({ to: user.email, subject: `Verify your ${APP_NAME} email`, html, text });
};
