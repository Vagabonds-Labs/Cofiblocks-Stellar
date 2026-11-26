import { logger } from '@/lib/logger';
import { expireDueProposals } from '@/services/app/DeliveryProposalsService';
import { deliverDueWebhooks } from '@/services/app/WebhooksService';

const INTERVAL_MS = 15_000;

/**
 * Background work for the VoiceLedger integration, in the API process:
 * expires deliveries nobody answered and sends the queued webhooks. Both are
 * safe to run in several processes at once.
 */
export function startIntegrationWorker(): () => void {
  if (process.env.INTEGRATION_WORKER === 'off') return () => {};
  if (!process.env.VOICELEDGER_NOTIFY_URL) {
    logger.warn('VOICELEDGER_NOTIFY_URL is not set: webhooks to VoiceLedger stay queued');
  }
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await expireDueProposals();
      await deliverDueWebhooks();
    } catch (error) {
      logger.error({ error }, 'Integration worker tick failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, INTERVAL_MS);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
