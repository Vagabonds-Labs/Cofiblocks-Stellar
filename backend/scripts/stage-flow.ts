/**
 * End-to-end test of the stages and documents, against Stellar Testnet,
 * with fresh test staff of the batch's cooperative:
 *
 *   npm run batch:stages -- "23-11-2026 KK-DEMO001"
 *
 * The batch must be RECEIVED (run `npm run voiceledger:deliveries` first).
 *
 * 1. Rejections: a Store Keeper tries Washing, an Industry Manager of
 *    another cooperative tries it, nobody can skip or repeat a stage.
 * 2. Industry Manager: Washing → Drying (Fermentation skipped). Sending the
 *    same signed transaction again returns the same step.
 * 3. Store Keeper: Storage → In transport to union.
 * 4. Export Manager (union): Prepared with exportable bag → Sold.
 * 5. Documents: the Industry Manager and the Export Manager each attach one;
 *    the same file twice is refused; the download matches its hash.
 * 6. "Verified on Stellar", the CSV export and the `batch.updated` webhooks.
 *
 * Calls the services directly (no HTTP server needed). Uses DATABASE_URL.
 */
import 'dotenv/config';
import { createHash, randomBytes } from 'crypto';
import { BatchStage, StaffRole } from '@prisma/client';
import { Keypair, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

import { ContractFactory } from '@/lib/StellarContracts';
import type { PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { prisma } from '@/lib/prisma';
import * as BatchesService from '@/services/app/BatchesService';
import * as DocumentsService from '@/services/app/DocumentsService';
import * as StagesService from '@/services/app/StagesService';
import { getExplorerBaseURL } from '@/services/onchain/OnChainEnvService';

import { createStaff } from './lib/staff';

const client = new ContractFactory().getClient();
const explorer = (hash: string) => `${getExplorerBaseURL()}/tx/${hash}`;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function rejects(task: () => Promise<unknown>, code: string, message: string) {
  try {
    await task();
  } catch (error) {
    const got = (error as { code?: string }).code;
    check(got === code, `${message}: ${got}`);
    return;
  }
  check(false, `${message}: it was accepted`);
}

const sign = (prepared: PreparedTransaction, keypair: Keypair) => {
  const tx = TransactionBuilder.fromXDR(prepared.xdr, client.networkPassphrase) as Transaction;
  tx.sign(keypair);
  return tx.toXDR();
};

type Staff = Awaited<ReturnType<typeof createStaff>>;

async function advance(staff: Staff, batchId: string, stage: BatchStage, extra: { weightKg?: number; notes?: string } = {}) {
  const input = { batchId, stage, weightKg: extra.weightKg ?? null, notes: extra.notes ?? `${stage} (script)` };
  const { prepared } = await StagesService.prepareStage(staff.user.id, input);
  const signed = sign(prepared, staff.keypair);
  const step = await StagesService.submitStage(staff.user.id, input, signed);
  check(step.stage === stage, `${stage} by ${staff.role}: ${explorer(step.tx_hash)}`);
  return { input, signed, step };
}

async function attach(staff: Staff, batchId: string, name: string, kind: DocumentsService.DocumentKind) {
  const buffer = Buffer.concat([Buffer.from(`%PDF-1.4\n% ${name}\n`), randomBytes(64)]);
  const file = { buffer, originalname: name, mimetype: 'application/pdf', size: buffer.length };
  const uploaded = await DocumentsService.upload(staff.user.id, batchId, file, kind);
  const prepared = await DocumentsService.prepareAttach(staff.user.id, batchId, uploaded.id);
  const document = await DocumentsService.submitAttach(staff.user.id, batchId, uploaded.id, sign(prepared, staff.keypair));
  check(document.attachedAt && document.txHash, `${name} attached by ${staff.role}: ${document.explorerUrl}`);
  return { file, document };
}

async function main() {
  const number = process.argv[2];
  if (!number) throw new Error('Usage: npm run batch:stages -- "<batch number>"');
  const batch = await prisma.batch.findUniqueOrThrow({ where: { number }, include: { organization: true } });
  check(batch.stage === BatchStage.RECEIVED, `Batch ${number} is RECEIVED`);
  const coop = batch.organization.code;
  const otherCoop = (await prisma.organization.findFirstOrThrow({ where: { kind: 'COOPERATIVE', code: { not: coop } } })).code;
  const startedAt = new Date();

  console.log('\nTest staff (roles granted on chain)');
  const industry = await createStaff(StaffRole.INDUSTRY_MANAGER, coop);
  const store = await createStaff(StaffRole.STORE_KEEPER, coop);
  const exporter = await createStaff(StaffRole.EXPORT_MANAGER, coop);
  const outsider = await createStaff(StaffRole.INDUSTRY_MANAGER, otherCoop);
  check(true, `Industry Manager, Store Keeper (${coop}), Export Manager (union), Industry Manager (${otherCoop})`);

  console.log('\n1. Rejections');
  await rejects(() => StagesService.prepareStage(store.user.id, { batchId: batch.id, stage: 'WASHING' }), 'UNAUTHORIZED', 'Store Keeper → Washing');
  await rejects(() => StagesService.prepareStage(outsider.user.id, { batchId: batch.id, stage: 'WASHING' }), 'WRONG_ORGANIZATION', `Industry Manager of ${otherCoop} → Washing`);
  await rejects(() => StagesService.prepareStage(industry.user.id, { batchId: batch.id, stage: 'DRYING' }), 'INVALID_TRANSITION', 'Received → Drying (skipping Washing)');

  console.log('\n2. Industry Manager');
  const washing = await advance(industry, batch.id, 'WASHING');
  const again = await StagesService.submitStage(industry.user.id, washing.input, washing.signed);
  check(again.tx_hash === washing.step.tx_hash, 'The same signed Washing again: same transaction');
  await rejects(() => StagesService.prepareStage(industry.user.id, { batchId: batch.id, stage: 'WASHING' }), 'INVALID_TRANSITION', 'Washing twice');
  await advance(industry, batch.id, 'DRYING', { weightKg: 18.4, notes: 'Dried on raised beds' });

  console.log('\n3. Store Keeper');
  await advance(store, batch.id, 'STORAGE');
  await advance(store, batch.id, 'IN_TRANSPORT_TO_UNION');

  console.log('\n4. Export Manager');
  await advance(exporter, batch.id, 'PREPARED_WITH_EXPORTABLE_BAG', { weightKg: 18 });
  await advance(exporter, batch.id, 'SOLD');
  await rejects(() => StagesService.prepareStage(exporter.user.id, { batchId: batch.id, stage: 'SOLD' }), 'INVALID_TRANSITION', 'Nothing after Sold');

  console.log('\n5. Documents');
  const first = await attach(industry, batch.id, 'washing-report.pdf', 'quality');
  await rejects(
    () => DocumentsService.upload(industry.user.id, batch.id, first.file, 'quality'),
    'DOCUMENT_ALREADY_ATTACHED',
    'The same file again'
  );
  await rejects(
    () => DocumentsService.upload(outsider.user.id, batch.id, first.file, 'quality'),
    'WRONG_ORGANIZATION',
    `A document from ${otherCoop}`
  );
  await attach(exporter, batch.id, 'sale-contract.pdf', 'sale');
  const { body } = await DocumentsService.download({ userId: store.user.id, isAdmin: false }, batch.id, first.document.id);
  check(createHash('sha256').update(body).digest('hex') === first.document.sha256, 'The downloaded file matches its on-chain hash');

  console.log('\n6. Verification, CSV and webhooks');
  const verification = await BatchesService.verifyBatch({ userId: store.user.id, isAdmin: false }, batch.id);
  check(
    verification.verified,
    `Verified on Stellar: ${verification.steps.length} steps and ${verification.documents.length} documents match the contract`
  );
  const csv = await BatchesService.exportBatchesCsv({ userId: store.user.id, isAdmin: false }, { search: number });
  const [header, row] = csv.trim().split('\r\n');
  const cols = header.split(',');
  const values = row.split(',');
  check(values[cols.indexOf('stage')] === 'SOLD' && values[cols.indexOf('sold_tx')]?.length === 64, 'CSV row with every step');
  check(values[cols.indexOf('documents')] === '2', 'CSV counts the 2 documents');
  const notices = await prisma.webhookNotification.findMany({
    where: { type: 'batch.updated', createdAt: { gte: startedAt } },
  });
  const stages = notices
    .map((n) => (n.body as { data?: { batch_id?: string; stage?: string } }).data)
    .filter((d) => d?.batch_id === number)
    .map((d) => d?.stage);
  check(stages.length === 6, `batch.updated queued for VoiceLedger: ${stages.join(', ')}`);
}

main()
  .then(() => {
    console.log('\nAll checks passed.');
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
