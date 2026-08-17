import nodemailer from 'nodemailer'

const RESET_TTL_MINUTES = 30

function trimEnv(name: string) {
  return (process.env[name] || '').trim().replace(/^["']|["']$/g, '')
}

export function resetBaseUrl(): string {
  const explicit = trimEnv('FRONTEND_URL') || trimEnv('PUBLIC_APP_URL')
  if (explicit) return explicit.replace(/\/$/, '')
  const cors = trimEnv('CORS_ORIGIN').split(',')[0]?.trim() || ''
  return cors.replace(/\/$/, '')
}

export function isMailConfigured(): boolean {
  return Boolean(trimEnv('MAIL_HOST') && trimEnv('MAIL_FROM') && resetBaseUrl())
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}

function transporter() {
  const port = Number(trimEnv('MAIL_PORT') || '587')
  const user = trimEnv('MAIL_USER')
  const pass = trimEnv('MAIL_PASSWORD')
  return nodemailer.createTransport({
    host: trimEnv('MAIL_HOST'),
    port,
    secure: port === 465,
    auth: user ? { user, pass } : undefined,
  })
}

export async function sendPasswordResetEmail(opts: {
  to: string
  resetUrl: string
  username: string
  centreName: string
}) {
  if (!isMailConfigured()) {
    throw new Error('Email is not configured')
  }

  const from = trimEnv('MAIL_FROM')
  const username = escapeHtml(opts.username)
  const centreName = escapeHtml(opts.centreName)
  const href = opts.resetUrl

  await transporter().sendMail({
    from,
    to: opts.to,
    subject: 'Password reset — Shrija Hallmark Suite',
    text: [
      'Shrija Hallmark Suite',
      '',
      `A password reset was requested for username ${opts.username} at ${opts.centreName}.`,
      '',
      `Reset your password (link expires in ${RESET_TTL_MINUTES} minutes):`,
      href,
      '',
      'If you did not request this, you can ignore this email. Your password will stay the same.',
    ].join('\n'),
    html: `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8fafc;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px 24px;">
          <tr>
            <td>
              <p style="margin:0 0 6px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#b8923a;font-weight:700;">Shrija Hallmark Suite</p>
              <h1 style="margin:0 0 16px;font-size:22px;color:#0b1f3a;">Password reset request</h1>
              <p style="margin:0 0 12px;line-height:1.5;font-size:15px;">
                A password reset was requested for username <strong>${username}</strong>
                at <strong>${centreName}</strong>.
              </p>
              <p style="margin:0 0 20px;line-height:1.5;font-size:15px;">
                This link expires in <strong>${RESET_TTL_MINUTES} minutes</strong> and can be used only once.
              </p>
              <p style="margin:0 0 24px;">
                <a href="${escapeHtml(href)}" style="display:inline-block;background:#0b1f3a;color:#ffffff;text-decoration:none;font-weight:700;padding:12px 18px;border-radius:8px;">Reset password</a>
              </p>
              <p style="margin:0;line-height:1.5;font-size:13px;color:#64748b;">
                If you did not request this, ignore this email. Your password will stay the same.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  })
}

export const PASSWORD_RESET_TTL_MINUTES = RESET_TTL_MINUTES
