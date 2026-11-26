/**
 * End-to-end test of the pilot's delivery flow, against a running backend and
 * Stellar Testnet, playing VoiceLedger's bot and a Collector:
 *
 *   npm run voiceledger:deliveries -- KK DEMO001 [--center Kirkir] [--port 4555]
 *
 * 1. The farmer is linked and consents (signed events, as the bot sends them).
 * 2. A Collector records a delivery → `delivery.proposed` reaches our fake
 *    VoiceLedger webhook (signature checked).
 * 3. The farmer confirms → the batch is created on chain; the same answer
 *    again changes nothing, a different one is `PROPOSAL_CLOSED`.
 * 4. The Collector signs the weight: a different weight is refused, the
 *    confirmed one moves the batch to RECEIVED → `batch.updated`.
 * 5. A second delivery is rejected by the farmer, a third one is cancelled by
 *    the Collector (→ `delivery.proposal_closed`).
 * 6. The bot reads the farmer's batches.
 *
 * The backend must send its webhooks here: start it with
 * `VOICELEDGER_NOTIFY_URL=http://localhost:<port>/voiceledger` and the same
 * `VOICELEDGER_NOTIFY_SECRET` as this script (launch config
 * `backend-local-db` does both). Uses DATABASE_URL to create the Collector.
 */
import 'dotenv/config';
import { createHash, randomUUID, timingSafeEqual } from 'crypto';
import { createServer } from 'http';
import { Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

import { ContractFactory } from '@/lib/StellarContracts';
import { prisma } from '@/lib/prisma';
import { signVoiceLedgerPayload } from '@/middleware/voiceLedgerSignature';
import * as DeliveryProposalsService from '@/services/app/DeliveryProposalsService';
import * as ReceptionService from '@/services/app/ReceptionService';
import { getExplorerBaseURL } from '@/services/onchain/OnChainEnvService';

import { createCollector } from './lib/staff';
import { linkAndConsent, sendEvent, sendOk, signedGet } from './lib/voiceledger';

const client = new ContractFactory().getClient();
const explorer = (hash: string) => `${getExplorerBaseURL()}/tx/${hash}`;

function option(name: string, fallback: string): string {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

// ── fake VoiceLedger webhook ────────────────────────────────────────────────

interface Notification {
  notification_id: string;
  type: string;
  data: Record<string, unknown>;
}

const received: Notification[] = [];
const waiters: Array<() => void> = [];

function startWebhook(port: number, secret: string) {
  const server = createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      const timestamp = String(req.headers['x-cofiblocks-timestamp'] ?? '');
      const expected = Buffer.from(signVoiceLedgerPayload(secret, timestamp, 'POST', req.url ?? '', raw));
      const got = Buffer.from(String(req.headers['x-cofiblocks-signature'] ?? ''));
      if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
        console.error('✗ Webhook with a bad signature');
        res.writeHead(401).end();
        return;
      }
      const notification = JSON.parse(raw.toString()) as Notification;
      if (!received.some((n) => n.notification_id === notification.notification_id)) received.push(notification);
      res.writeHead(204).end();
      waiters.splice(0).forEach((wake) => wake());
    });
  });
  server.listen(port);
  return server;
}

/** Waits (up to 90 s: the worker runs every 15 s) for a matching notification. */
async function waitFor(type: string, match: (data: Record<string, unknown>) => boolean): Promise<Notification> {
  const deadline = Date.now() + 90_000;
  for (;;) {
    const found = received.find((n) => n.type === type && match(n.data));
    if (found) return found;
    if (Date.now() > deadline) {
      console.error(`✗ No ${type} webhook within 90 s. Is the backend's VOICELEDGER_NOTIFY_URL pointing here?`);
      process.exit(1);
    }
    await new Promise<void>((wake) => {
      waiters.push(wake);
      setTimeout(wake, 2000);
    });
  }
}

const answer = (proposalId: string, farmerRef: string, accepted: boolean) => ({
  proposal_id: proposalId,
  farmer_ref: farmerRef,
  accepted,
  answered_at: new Date().toISOString(),
  transcript: accepted ? 'Eeyyee, kun kan kooti' : 'Lakki',
});

async function main() {
  const [coopCode, farmerId] = process.argv.slice(2).filter((arg, i, all) => !arg.startsWith('--') && !all[i - 1]?.startsWith('--'));
  if (!coopCode || !farmerId) {
    console.error('Usage: npm run voiceledger:deliveries -- <COOP_CODE> <FARMER_ID> [--center <name>] [--port 4555]');
    process.exit(1);
  }
  const notifySecret = process.env.VOICELEDGER_NOTIFY_SECRET;
  if (!notifySecret) throw new Error('VOICELEDGER_NOTIFY_SECRET is not set (the same one the backend signs with)');
  const server = startWebhook(Number(option('--port', '4555')), notifySecret);

  console.log('1. The farmer links the bot and consents');
  const { farmerRef } = await linkAndConsent({ coopCode, farmerId });
  check(true, `${farmerRef} linked and consented`);

  console.log('\n2. A Collector records a delivery at the collection center');
  const collector = await createCollector(coopCode.toUpperCase(), option('--center', 'Kirkir'), 'Delivery flow collector');
  const farmer = await prisma.farmer.findFirstOrThrow({
    where: { coopFarmerId: farmerId.toUpperCase(), organization: { code: coopCode.toUpperCase() } },
  });
  const weightKg = 45.5;
  const proposal = await DeliveryProposalsService.propose(collector.user.id, { farmerId: farmer.id, weightKg });
  check(proposal.status === 'PENDING', `Recorded ${weightKg} kg at ${proposal.collectionCenter.name}: waiting for the farmer`);
  const proposed = await waitFor('delivery.proposed', (d) => d.proposal_id === proposal.id);
  check(proposed.data.weight_kg === weightKg, 'VoiceLedger got delivery.proposed, signed, with the weight');

  console.log('\n3. The farmer confirms it in the bot');
  const yes = await sendOk('delivery.confirmation', answer(proposal.id, farmerRef, true));
  const batchId = String(yes.result.batch_id);
  check(yes.result.tx_hash, `Batch "${batchId}" created on chain: ${explorer(String(yes.result.tx_hash))}`);
  const again = await sendOk('delivery.confirmation', answer(proposal.id, farmerRef, true));
  check(again.result.tx_hash === yes.result.tx_hash, 'The same answer with a new event_id: same batch, nothing new on chain');
  const flip = await sendEvent('delivery.confirmation', answer(proposal.id, farmerRef, false));
  check(flip.status === 409 && flip.body.error?.code === 'PROPOSAL_CLOSED', 'A different answer afterwards: 409 PROPOSAL_CLOSED');
  await waitFor('batch.updated', (d) => d.batch_id === batchId && d.stage === 'DELIVERED');
  check(true, 'VoiceLedger got batch.updated (DELIVERED)');

  console.log('\n4. The Collector signs the weight and the receipt');
  const receipt = createHash('sha256').update(`Receipt ${batchId} ${randomUUID()}`).digest('hex');
  try {
    await ReceptionService.prepareReception(collector.user.id, { batchNumber: batchId, weightKg: 50, receiptSha256: receipt });
    check(false, 'A weight different from the confirmed one is refused');
  } catch (error) {
    check((error as { code?: string }).code === 'WEIGHT_MISMATCH', 'A weight different from the confirmed one: WEIGHT_MISMATCH');
  }
  const input = { batchNumber: batchId, weightKg, receiptSha256: receipt, notes: 'Delivery flow test' };
  const { prepared } = await ReceptionService.prepareReception(collector.user.id, input);
  const tx = TransactionBuilder.fromXDR(prepared.xdr, client.networkPassphrase) as Transaction;
  tx.sign(collector.keypair);
  const reception = await ReceptionService.submitReception(collector.user.id, input, tx.toXDR());
  check(reception.stage === 'RECEIVED', `Weight on chain: ${explorer(reception.tx_hash)}`);
  await waitFor('batch.updated', (d) => d.batch_id === batchId && d.stage === 'RECEIVED');
  check(true, 'VoiceLedger got batch.updated (RECEIVED)');

  console.log('\n5. A delivery the farmer rejects, and one the Collector cancels');
  const second = await DeliveryProposalsService.propose(collector.user.id, { farmerId: farmer.id, weightKg: 30 });
  await waitFor('delivery.proposed', (d) => d.proposal_id === second.id);
  const no = await sendOk('delivery.confirmation', answer(second.id, farmerRef, false));
  check(no.result.accepted === false && no.result.batch_id === null, 'Rejected: nothing recorded');
  const third = await DeliveryProposalsService.propose(collector.user.id, { farmerId: farmer.id, weightKg: 12.25 });
  const cancelled = await DeliveryProposalsService.cancel(collector.user.id, third.id);
  check(cancelled.status === 'CANCELLED', 'The Collector cancelled the third one');
  await waitFor('delivery.proposal_closed', (d) => d.proposal_id === third.id && d.reason === 'cancelled');
  check(true, 'VoiceLedger got delivery.proposal_closed (cancelled)');
  const late = await sendEvent('delivery.confirmation', answer(third.id, farmerRef, true));
  check(late.status === 409 && late.body.error?.code === 'PROPOSAL_CLOSED', 'Confirming it afterwards: 409 PROPOSAL_CLOSED');

  console.log('\n6. The farmer asks the bot where their coffee is');
  const batches = await signedGet(`/api/integrations/voiceledger/farmers/${farmerRef}/batches`);
  const list = batches.body.batches as Array<{ batch_id: string; stage: string }>;
  check(batches.status === 200, 'Signed GET of the farmer\'s batches');
  check(list.some((b) => b.batch_id === batchId && b.stage === 'RECEIVED'), `"${batchId}" is RECEIVED`);

  console.log('\nAll checks passed.');
  server.close();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
