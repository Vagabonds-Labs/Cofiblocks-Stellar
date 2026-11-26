/**
 * Signed client for our VoiceLedger integration API, exactly as VoiceLedger's
 * bot calls it. Shared by the simulator scripts.
 */
import 'dotenv/config';
import { createHash, randomUUID } from 'crypto';

import { signVoiceLedgerPayload } from '@/middleware/voiceLedgerSignature';

const PATH = '/api/integrations/voiceledger/events';

function api() {
  return process.env.API_URL || 'http://localhost:4000';
}

function secret() {
  const value = process.env.VOICELEDGER_WEBHOOK_SECRET;
  if (!value) throw new Error('VOICELEDGER_WEBHOOK_SECRET is not set');
  return value;
}

/** A signed `GET`, as the bot reads a farmer's batches or an event's status. */
export async function signedGet(path: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${api()}${path}`, {
    headers: {
      'X-VoiceLedger-Timestamp': timestamp,
      'X-VoiceLedger-Signature': signVoiceLedgerPayload(secret(), timestamp, 'GET', path, ''),
    },
  });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

export interface EventResponse {
  status: number;
  eventId: string;
  body: { status: string; result?: Record<string, unknown>; error?: { code: string; message: string; details?: unknown } };
}

/** Sends one event and returns the HTTP status and body, whatever they are. */
export async function sendEvent(type: string, data: Record<string, unknown>, eventId: string = randomUUID()): Promise<EventResponse> {
  const body = JSON.stringify({ event_id: eventId, type, occurred_at: new Date().toISOString(), data });
  const timestamp = String(Math.floor(Date.now() / 1000));
  const res = await fetch(`${api()}${PATH}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-VoiceLedger-Timestamp': timestamp,
      'X-VoiceLedger-Signature': signVoiceLedgerPayload(secret(), timestamp, 'POST', PATH, body),
    },
    body,
  });
  return { status: res.status, eventId, body: (await res.json()) as EventResponse['body'] };
}

/** Sends one event that must succeed; exits with the error otherwise. */
export async function sendOk(type: string, data: Record<string, unknown>, eventId?: string) {
  const response = await sendEvent(type, data, eventId);
  if (response.status !== 200) {
    console.error(`✗ ${type} → ${response.status}`, JSON.stringify(response.body.error, null, 2));
    process.exit(1);
  }
  return { eventId: response.eventId, result: response.body.result! };
}

/** A fake Telegram user ID derived from the farmer, in a range real accounts do not use yet. */
export function simulatedTelegramId(coopCode: string, farmerId: string): string {
  const digest = createHash('sha256').update(`${coopCode.toUpperCase()}-${farmerId.toUpperCase()}`).digest();
  return String(9_000_000_000_000n + (digest.readBigUInt64BE(0) % 999_999_999_999n));
}

/** Links the farmer and records their consent: what every delivery needs first. */
export async function linkAndConsent(opts: { coopCode: string; farmerId: string; telegram?: string }) {
  // The same simulated Telegram account for the same farmer on every run, so
  // it can be repeated: linking again answers `already_linked`.
  const telegram = opts.telegram ?? simulatedTelegramId(opts.coopCode, opts.farmerId);
  const linked = await sendOk('farmer.linked', {
    coop_code: opts.coopCode,
    farmer_id: opts.farmerId,
    telegram_user_id: telegram,
    language: 'om',
  });
  const farmerRef = String(linked.result.farmer_ref);
  const consent = await sendOk('farmer.consent', {
    farmer_ref: farmerRef,
    consent_version: '2026-11-v1',
    language: 'om',
    accepted: true,
    answered_at: new Date().toISOString(),
    declarations: {
      data_processing: true,
      no_deforestation_since_2020_12_31: true,
      information_is_accurate: true,
    },
  });
  return { farmerRef, linked, consent };
}

/** The farmer's journey up to a delivery (the bot reports it). Returns each step's result. */
export async function farmerJourney(opts: { coopCode: string; farmerId: string; center: string; kg: number; telegram?: string }) {
  const { farmerRef, linked, consent } = await linkAndConsent(opts);
  const profile = await sendOk('farmer.profile', {
    farmer_ref: farmerRef,
    plots: [{ name: 'Plot 1', size: { value: 1.5, unit: 'fachasa' }, location: { lat: 7.86, lng: 36.62, source: 'shared' } }],
    practices: { shade_trees: true, fertilizer: 'compost' },
  });
  const deliveryData = { farmer_ref: farmerRef, collection_center: opts.center, estimated_kg: opts.kg, ripeness: 'ripe' };
  const delivery = await sendOk('delivery.created', deliveryData);
  return { farmerRef, linked, consent, profile, delivery, deliveryData };
}
