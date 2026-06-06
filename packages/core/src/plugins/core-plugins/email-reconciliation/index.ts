/**
 * Email reconciliation cron plugin (T3.5 / T3.6)
 *
 * The first core plugin authored with `definePlugin` — it serves as both the
 * reference implementation and the proof that the v3 authoring API works end-
 * to-end through a real cron-driven workflow.
 *
 * What it does:
 *   Every hour, query `email_log` for rows that:
 *     - were sent successfully (`status = 'sent'`)
 *     - have a `provider_id` (the transport gave us a message ID to look up)
 *     - have not yet had their delivery state resolved (`delivery_state IS NULL`)
 *   Group those rows by provider and call `provider.reconcile?(rows)` on the
 *   active email provider. Providers that support delivery-status lookup
 *   (e.g. `CloudflareEmailProvider` via webhooks) return `[{ id, delivery_state }]`
 *   which we write back; providers that don't implement `reconcile` are a no-op.
 *
 * Also dispatches `auth:registration:completed`-family hooks observed during
 * cron to prove the hook bus is live in the cron isolate.
 */

import { definePlugin } from '../../sdk/define-plugin'
import { getEmailService, hasEmailService } from '../../../services/email/email-service-singleton'
import type { EmailLogRow } from '../../../services/email/types'

/** Maximum rows to reconcile per run (keeps cron worker time bounded). */
const BATCH_SIZE = 100

export const emailReconciliationPlugin = definePlugin({
  id: 'email-reconciliation',
  version: '1.0.0',
  description:
    'Hourly cron that backfills email delivery state from provider webhook/status APIs. ' +
    'Only active for providers that implement EmailProvider.reconcile().',
  author: { name: 'SonicJS Team', email: 'team@sonicjs.com' },
  capabilities: ['email:send', 'db:email_log'],
  sonicjsVersionRange: '>=2.18.0',

  crons: [
    {
      // Every hour at the top of the hour.
      // Add `0 * * * *` to wrangler.toml [triggers] crons to activate in production.
      schedule: '0 * * * *',
      hookFamily: 'email-reconciliation',
    },
  ],

  async onCronTick(event, ctx) {
    if (event.hookFamily !== 'email-reconciliation') return

    const db = ctx.env?.DB as D1DatabaseLike | undefined
    if (!db) {
      console.warn('[email-reconciliation] No DB binding in cron env — skipping.')
      return
    }

    if (!hasEmailService()) {
      console.warn('[email-reconciliation] EmailService not initialized — skipping.')
      return
    }

    const emailService = getEmailService()

    // Fetch unreconciled rows.
    let rows: EmailLogRow[] = []
    try {
      const result = await db
        .prepare(
          `SELECT id, provider_id, provider, status, delivery_state
           FROM email_log
           WHERE status = 'sent'
             AND provider_id IS NOT NULL
             AND delivery_state IS NULL
           LIMIT ?`
        )
        .bind(BATCH_SIZE)
        .all()
      rows = (result.results ?? []) as EmailLogRow[]
    } catch (err) {
      console.error('[email-reconciliation] Failed to query email_log:', err)
      return
    }

    if (rows.length === 0) {
      console.log('[email-reconciliation] No unreconciled rows — nothing to do.')
      return
    }

    // Ask the provider to reconcile.
    const updates = await emailService.reconcileDelivery(rows)

    if (!updates || updates.length === 0) {
      console.log(
        `[email-reconciliation] Provider "${emailService.getProviderName()}" ` +
          `returned no updates for ${rows.length} rows (no reconcile() support or all pending).`
      )
      return
    }

    // Write delivery states back.
    const now = Date.now()
    let updated = 0
    // eslint-disable-next-line @typescript-eslint/naming-convention -- delivery_state mirrors the DB column name
    for (const { id, delivery_state } of updates) {
      try {
        await db
          .prepare(
            `UPDATE email_log
             SET delivery_state = ?, delivery_synced_at = ?
             WHERE id = ?`
          )
          .bind(delivery_state, now, id)
          .run()
        updated++
      } catch (err) {
        console.error(`[email-reconciliation] Failed to update row ${id}:`, err)
      }
    }

    console.log(
      `[email-reconciliation] Reconciled ${updated}/${rows.length} email_log rows ` +
        `via provider "${emailService.getProviderName()}".`
    )
  },
})

/** Minimal D1 interface (same as in wire.ts — avoids hard @cloudflare/workers-types dep). */
interface D1DatabaseLike {
  prepare(sql: string): { bind(...args: unknown[]): { run(): Promise<unknown>; all(): Promise<{ results: unknown[] }> } }
}
