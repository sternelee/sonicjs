/**
 * Email Plugin — Payload-shaped pilot port.
 *
 * Send transactional emails (Resend). Ports the legacy PluginBuilder shape to
 * definePlugin with a declarative menu entry + configSchema for the four
 * settings the admin form historically asked for.
 */

import { Hono } from 'hono'
import { definePlugin } from '../../sdk/define-plugin'

const emailRoutes = new Hono()

// POST endpoint kept for the existing JSON-shape integration. Schema-driven
// settings save flows through /admin/plugins/email/configure (P5).
emailRoutes.post('/settings', async (c: any) => {
  try {
    const body = await c.req.json()
    const db = c.env.DB

    await db.prepare(`
      UPDATE plugins
      SET settings = ?,
          updated_at = unixepoch()
      WHERE id = 'email'
    `).bind(JSON.stringify(body)).run()

    return c.json({ success: true })
  } catch (error) {
    console.error('Error saving email settings:', error)
    return c.json({ success: false, error: 'Failed to save settings' }, 500)
  }
})

emailRoutes.post('/test', async (c: any) => {
  try {
    const db = c.env.DB
    const body = await c.req.json()

    const plugin = await db.prepare(`
      SELECT settings FROM plugins WHERE id = 'email'
    `).first() as { settings: string | null } | null

    if (!plugin?.settings) {
      return c.json({
        success: false,
        error: 'Email settings not configured. Please save your settings first.',
      }, 400)
    }

    const settings = JSON.parse(plugin.settings)
    if (!settings.apiKey || !settings.fromEmail || !settings.fromName) {
      return c.json({
        success: false,
        error: 'Missing required settings. Please configure API Key, From Email, and From Name.',
      }, 400)
    }

    const toEmail = body.toEmail || settings.fromEmail
    if (!toEmail.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return c.json({ success: false, error: 'Invalid email address format' }, 400)
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${settings.fromName} <${settings.fromEmail}>`,
        to: [toEmail],
        subject: 'Test Email from SonicJS',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #667eea;">Test Email Successful! 🎉</h1>
            <p>This is a test email from your SonicJS Email plugin.</p>
            <p><strong>Configuration:</strong></p>
            <ul>
              <li>From: ${settings.fromName} &lt;${settings.fromEmail}&gt;</li>
              <li>Reply-To: ${settings.replyTo || 'Not set'}</li>
              <li>Sent at: ${new Date().toISOString()}</li>
            </ul>
            <p>Your email settings are working correctly!</p>
          </div>
        `,
        reply_to: settings.replyTo || settings.fromEmail,
      }),
    })

    const data = await response.json() as any

    if (!response.ok) {
      console.error('Resend API error:', data)
      return c.json({
        success: false,
        error: data.message || 'Failed to send test email. Check your API key and domain verification.',
      }, response.status)
    }

    return c.json({
      success: true,
      message: `Test email sent successfully to ${toEmail}`,
      emailId: data.id,
    })
  } catch (error: any) {
    console.error('Test email error:', error)
    return c.json({
      success: false,
      error: error.message || 'An error occurred while sending test email',
    }, 500)
  }
})

export const emailPlugin = definePlugin({
  id: 'email',
  version: '1.0.0',
  name: 'Email',
  description: 'Send transactional emails using Resend.',
  sonicjsVersionRange: '^3.0.0',
  author: { name: 'SonicJS Team', email: 'team@sonicjs.com' },
  capabilities: ['email:send'],

  register(app) {
    app.route('/admin/plugins/email', emailRoutes)
  },

  menu: [
    {
      label: 'Email',
      path: '/admin/plugins/email/configure',
      icon: 'envelope',
      order: 80,
      permissions: ['email:manage'],
    },
  ],

  configSchema: {
    apiKey: {
      type: 'string',
      label: 'Resend API Key',
      sensitive: true,
      required: true,
      placeholder: 're_xxxxxxxxxxxx',
      description: 'Sign up at resend.com and create a server-side API key.',
    },
    fromEmail: {
      type: 'string',
      label: 'From Email',
      format: 'email',
      required: true,
      placeholder: 'noreply@example.com',
    },
    fromName: {
      type: 'string',
      label: 'From Name',
      required: true,
      placeholder: 'SonicJS',
      default: 'SonicJS',
    },
    replyTo: {
      type: 'string',
      label: 'Reply-To (optional)',
      format: 'email',
      placeholder: 'support@example.com',
    },
  },

  activate: async () => {
    console.info('✅ Email plugin activated')
  },
  deactivate: async () => {
    console.info('❌ Email plugin deactivated')
  },
})

export function createEmailPlugin() {
  return emailPlugin
}
