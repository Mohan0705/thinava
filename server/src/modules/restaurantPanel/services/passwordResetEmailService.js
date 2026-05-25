const { logger } = require('../../../lib/logger')

const PASSWORD_RESET_SUBJECT = 'Reset your THINAVA restaurant password'

const trimTrailingSlash = (value) => String(value || '').replace(/\/$/, '')

const getFromEmail = (provider) =>
  process.env.PASSWORD_RESET_FROM_EMAIL ||
  process.env.EMAIL_FROM ||
  process.env[`${provider.toUpperCase()}_FROM_EMAIL`] ||
  process.env.BREVO_SENDER_EMAIL ||
  ''

const getFromName = () => process.env.PASSWORD_RESET_FROM_NAME || process.env.EMAIL_FROM_NAME || 'THINAVA'

const buildPasswordResetEmail = ({ resetUrl, ownerName, restaurantName, expiresInMinutes }) => {
  const greetingName = ownerName || restaurantName || 'Restaurant partner'
  const text = [
    `Hi ${greetingName},`,
    '',
    'Use the link below to reset your THINAVA restaurant account password:',
    resetUrl,
    '',
    `This link expires in ${expiresInMinutes} minutes.`,
    'If you did not request this reset, you can ignore this email.',
  ].join('\n')

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <p>Hi ${greetingName},</p>
      <p>Use this secure link to reset your THINAVA restaurant account password.</p>
      <p>
        <a href="${resetUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 18px;border-radius:8px;text-decoration:none;font-weight:700">
          Reset password
        </a>
      </p>
      <p>If the button does not work, open this URL:</p>
      <p style="word-break:break-all"><a href="${resetUrl}">${resetUrl}</a></p>
      <p>This link expires in ${expiresInMinutes} minutes.</p>
      <p>If you did not request this reset, you can ignore this email.</p>
    </div>
  `

  return { text, html }
}

const providers = {
  resend: {
    apiKey: () => process.env.RESEND_API_KEY,
    endpoint: 'https://api.resend.com/emails',
    buildRequest: ({ apiKey, fromEmail, toEmail, subject, text, html }) => ({
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        from: `${getFromName()} <${fromEmail}>`,
        to: [toEmail],
        subject,
        text,
        html,
      },
    }),
  },
  brevo: {
    apiKey: () => process.env.BREVO_API_KEY,
    endpoint: 'https://api.brevo.com/v3/smtp/email',
    buildRequest: ({ apiKey, fromEmail, toEmail, subject, text, html }) => ({
      headers: {
        'api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: {
        sender: { email: fromEmail, name: getFromName() },
        to: [{ email: toEmail }],
        subject,
        textContent: text,
        htmlContent: html,
      },
    }),
  },
  sendgrid: {
    apiKey: () => process.env.SENDGRID_API_KEY,
    endpoint: 'https://api.sendgrid.com/v3/mail/send',
    buildRequest: ({ apiKey, fromEmail, toEmail, subject, text, html }) => ({
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: {
        personalizations: [{ to: [{ email: toEmail }] }],
        from: { email: fromEmail, name: getFromName() },
        subject,
        content: [
          { type: 'text/plain', value: text },
          { type: 'text/html', value: html },
        ],
      },
    }),
  },
}

const getPasswordResetEmailStatus = () => {
  const requestedProvider = String(process.env.PASSWORD_RESET_EMAIL_PROVIDER || '').toLowerCase().trim()
  const providerNames = requestedProvider ? [requestedProvider] : ['resend', 'brevo', 'sendgrid']

  for (const providerName of providerNames) {
    const provider = providers[providerName]
    if (!provider) {
      return {
        configured: false,
        provider: providerName,
        reason: 'unsupported_provider',
      }
    }

    const hasApiKey = Boolean(provider.apiKey())
    const hasFromEmail = Boolean(getFromEmail(providerName))
    if (hasApiKey && hasFromEmail) {
      return {
        configured: true,
        provider: providerName,
      }
    }

    if (requestedProvider) {
      return {
        configured: false,
        provider: providerName,
        reason: hasApiKey ? 'missing_from_email' : 'missing_api_key',
      }
    }
  }

  return {
    configured: false,
    provider: null,
    reason: 'missing_email_provider',
  }
}

const sendPasswordResetEmail = async ({
  toEmail,
  resetUrl,
  ownerName,
  restaurantName,
  expiresInMinutes,
}) => {
  const status = getPasswordResetEmailStatus()
  if (!status.configured) {
    return {
      sent: false,
      provider: status.provider,
      fallbackReason: status.reason,
    }
  }

  if (typeof fetch !== 'function') {
    return {
      sent: false,
      provider: status.provider,
      fallbackReason: 'fetch_unavailable',
    }
  }

  const provider = providers[status.provider]
  const fromEmail = getFromEmail(status.provider)
  const { text, html } = buildPasswordResetEmail({
    resetUrl,
    ownerName,
    restaurantName,
    expiresInMinutes,
  })
  const request = provider.buildRequest({
    apiKey: provider.apiKey(),
    fromEmail,
    toEmail,
    subject: PASSWORD_RESET_SUBJECT,
    text,
    html,
  })

  try {
    const response = await fetch(provider.endpoint, {
      method: 'POST',
      headers: request.headers,
      body: JSON.stringify(request.body),
    })

    if (!response.ok) {
      const responseText = await response.text().catch(() => '')
      logger.warn('Password reset email provider rejected request', {
        tag: 'restaurant_password_reset',
        provider: status.provider,
        status: response.status,
        response: responseText.slice(0, 200),
      })

      return {
        sent: false,
        provider: status.provider,
        fallbackReason: 'provider_rejected',
      }
    }

    logger.info('Password reset email sent', {
      tag: 'restaurant_password_reset',
      provider: status.provider,
      email: toEmail,
    })

    return {
      sent: true,
      provider: status.provider,
    }
  } catch (error) {
    logger.warn('Password reset email send failed', {
      tag: 'restaurant_password_reset',
      provider: status.provider,
      email: toEmail,
      error,
    })

    return {
      sent: false,
      provider: status.provider,
      fallbackReason: 'send_failed',
    }
  }
}

const getFrontendResetUrl = (token) => {
  const frontendUrl = trimTrailingSlash(process.env.FRONTEND_URL || 'http://localhost:3000')
  return `${frontendUrl}/reset-password?token=${encodeURIComponent(token)}`
}

module.exports = {
  getFrontendResetUrl,
  getPasswordResetEmailStatus,
  sendPasswordResetEmail,
}
