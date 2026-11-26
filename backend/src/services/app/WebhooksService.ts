import { randomUUID } from 'crypto';
import { Prisma, WebhookStatus } from '@prisma/client';

import { logger } from '@/lib/logger';
import { prisma } from '@/lib/prisma';
import { signVoiceLedgerPayload } from '@/middleware/voiceLedgerSignature';

/**
 * Notifications to VoiceLedger's webhook (contract in
 * `docs/voiceledger-integration.md`, "Webhooks to VoiceLedger").
 *
 * They go through an outbox: whoever changes the data enqueues the
 * notification in the same database transaction, and a worker sends it,
 * retrying for 24 hours. So a crash never loses one, and a retry never
 * creates a second one (`dedupeKey`).
 */

export type WebhookType = 'delivery.proposed' | 'delivery.proposal_closed' | 'batch.updated';

export const COFIBLOCKS_TIMESTAMP_HEADER = 'X-CofiBlocks-Timestamp';
export const COFIBLOCKS_SIGNATURE_HEADER = 'X-CofiBlocks-Signature';

/** Minutes to wait after each failed attempt; then hourly. */
const RETRY_MINUTES = [1, 5, 15, 60];
const GIVE_UP_AFTER_MS = 24 * 3600 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;
/** A claimed notification is not picked again for this long (another worker may be sending it). */
const LEASE_MS = 2 * 60 * 1000;
const BATCH_SIZE = 20;

/** A new outbox row: the envelope VoiceLedger receives, with its `notification_id`. */
export function webhookRow(dedupeKey: string, type: WebhookType, data: Record<string, unknown>) {
  const id = randomUUID();
  const body = { notification_id: id, type, occurred_at: new Date().toISOString(), data };
  return { id, dedupeKey, type, body: body as Prisma.InputJsonValue };
}

/**
 * Adds a notification to the outbox. `db` is `prisma` or an interactive
 * transaction; with `prisma` the result is a Prisma promise, so it can also go
 * in a `$transaction([...])` with the change it reports. Enqueueing the same
 * `dedupeKey` twice is a no-op.
 */
export function enqueueWebhook(
  dedupeKey: string,
  type: WebhookType,
  data: Record<string, unknown>,
  db: Prisma.TransactionClient = prisma
) {
  return db.webhookNotification.upsert({
    where: { dedupeKey },
    create: webhookRow(dedupeKey, type, data),
    update: {},
  });
}

function webhookConfig() {
  const url = process.env.VOICELEDGER_NOTIFY_URL;
  const secret = process.env.VOICELEDGER_NOTIFY_SECRET;
  return url && secret ? { url, secret } : null;
}

/** Sends one notification. Resolves on a 2xx; throws otherwise. */
async function post(config: { url: string; secret: string }, body: Prisma.JsonValue): Promise<void> {
  const raw = JSON.stringify(body);
  const url = new URL(config.url);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = signVoiceLedgerPayload(config.secret, timestamp, 'POST', url.pathname + url.search, raw);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [COFIBLOCKS_TIMESTAMP_HEADER]: timestamp,
      [COFIBLOCKS_SIGNATURE_HEADER]: signature,
    },
    body: raw,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
}

/** Sends the notifications that are due. Safe to run from several processes at once. */
export async function deliverDueWebhooks(): Promise<number> {
  const config = webhookConfig();
  if (!config) return 0;

  const due = await prisma.webhookNotification.findMany({
    where: { status: WebhookStatus.PENDING, nextAttemptAt: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: BATCH_SIZE,
  });

  let delivered = 0;
  for (const notification of due) {
    // Claim it: only one worker wins the lease.
    const { count } = await prisma.webhookNotification.updateMany({
      where: { id: notification.id, status: WebhookStatus.PENDING, nextAttemptAt: notification.nextAttemptAt },
      data: { nextAttemptAt: new Date(Date.now() + LEASE_MS), attempts: { increment: 1 } },
    });
    if (count !== 1) continue;

    try {
      await post(config, notification.body);
      await prisma.webhookNotification.update({
        where: { id: notification.id },
        data: { status: WebhookStatus.DELIVERED, deliveredAt: new Date(), lastError: null },
      });
      delivered++;
    } catch (error) {
      const attempts = notification.attempts + 1;
      const delay = (RETRY_MINUTES[attempts - 1] ?? 60) * 60 * 1000;
      const next = new Date(Date.now() + delay);
      const giveUp = next.getTime() - notification.createdAt.getTime() > GIVE_UP_AFTER_MS;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.webhookNotification.update({
        where: { id: notification.id },
        data: {
          status: giveUp ? WebhookStatus.FAILED : WebhookStatus.PENDING,
          nextAttemptAt: next,
          lastError: message.slice(0, 500),
        },
      });
      (giveUp ? logger.error : logger.warn).call(
        logger,
        { notificationId: notification.id, type: notification.type, attempts, error: message },
        giveUp ? 'VoiceLedger webhook failed for 24 hours: giving up' : 'VoiceLedger webhook failed: will retry'
      );
    }
  }
  return delivered;
}
