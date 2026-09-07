import { ContractFactory } from '@/lib/StellarContracts';
import { PreparedTransaction } from '@/lib/StellarContracts/types/transactions';
import { ROLES } from '@/lib/StellarContracts/types/contracts';
import { stroopsToUsd } from '@/lib/StellarContracts/utils';
import { HttpException } from '@/exceptions/HttpException';
import { logger } from '@/lib/logger';

const contractFactory = new ContractFactory();

/**
 * Cuentas que se acreditan por página.
 *
 * El `distribute()` de Cairo iteraba las listas completas en una sola llamada.
 * Soroban corta por presupuesto de CPU, memoria y footprint, así que el reparto
 * va de a páginas y hay que repetirlo hasta que el contrato diga `done`.
 */
const ACCOUNTS_PER_PAGE = 25;

/**
 * Páginas por request HTTP.
 *
 * Cada página es una transacción confirmada en red — unos segundos — así que
 * este número es un presupuesto de tiempo, no de trabajo: cinco páginas entran
 * cómodas debajo del timeout habitual de un proxy, diez ya no. El panel vuelve
 * a llamar hasta terminar, y como el cursor vive en el contrato y no acá,
 * retomar es seguro incluso si un request se corta por el medio.
 */
const MAX_PAGES_PER_REQUEST = 5;

export interface DistributionRun {
  epoch: number;
  phase: number;
  cursor: number;
}

export interface DistributionRunResult {
  /** `true` cuando el reparto del epoch terminó y no hay nada más que hacer. */
  done: boolean;
  /** Páginas confirmadas en este request. */
  pages: number;
  /** Hash de cada página, en orden. */
  txHashes: string[];
  /** Estado que quedó en el contrato, o `null` si terminó. */
  run: DistributionRun | null;
}

function toRun(raw: Record<string, unknown> | null): DistributionRun | null {
  if (!raw) return null;
  return {
    epoch: Number(raw.epoch ?? 0),
    phase: Number(raw.phase ?? 0),
    cursor: Number(raw.cursor ?? 0),
  };
}

/**
 * Avanza el reparto de utilidades, de a páginas.
 *
 * La primera llamada congela el epoch en curso: las compras que entren después
 * se acumulan en el siguiente y no compiten con el reparto en marcha. Si el
 * request termina con `done: false`, hay que volver a llamar para continuar.
 */
export async function runDistribution(): Promise<DistributionRunResult> {
  const distribution = contractFactory.getDistributionService();
  const submitter = contractFactory.getTxSubmitter();

  let run = toRun(await distribution.getRun());
  const txHashes: string[] = [];

  for (let page = 0; page < MAX_PAGES_PER_REQUEST; page++) {
    const cursor = run?.cursor ?? 0;

    const tx = await distribution.distribute(cursor, ACCOUNTS_PER_PAGE);
    const { hash } = await submitter.submitAsService(tx);
    txHashes.push(hash);

    // El progreso se relee de la cadena en vez de confiar en el valor de retorno
    // del submit: es la misma fuente que usa el contrato para validar el cursor.
    run = toRun(await distribution.getRun());

    logger.info(
      { hash, cursor, next: run?.cursor ?? null },
      'Distribution page confirmed'
    );

    // El contrato borra el run al terminar el epoch.
    if (!run) {
      return { done: true, pages: page + 1, txHashes, run: null };
    }
  }

  return { done: false, pages: txHashes.length, txHashes, run };
}

/** Roles cuyo saldo un usuario puede consultar y reclamar por sí mismo. */
const SELF_CLAIMABLE_ROLES = [ROLES.CONSUMER, ROLES.PRODUCER, ROLES.ROASTER] as const;
export type SelfClaimableRole = (typeof SELF_CLAIMABLE_ROLES)[number];

function assertSelfClaimable(role: ROLES): asserts role is SelfClaimableRole {
  if (!SELF_CLAIMABLE_ROLES.includes(role as SelfClaimableRole)) {
    throw new HttpException(
      403,
      `Role ${role} cannot be claimed from the app`,
      'ROLE_NOT_SELF_CLAIMABLE'
    );
  }
}

/**
 * Un usuario sólo puede reclamar por un rol que efectivamente tiene.
 *
 * CONSUMER queda abierto porque el marketplace se lo asigna on-chain en la
 * compra: si nunca compró, su saldo es 0 y el contrato rechaza igual.
 */
export function assertUserHoldsRole(
  role: SelfClaimableRole,
  user: { is_producer: boolean; is_roaster: boolean }
): void {
  if (role === ROLES.PRODUCER && !user.is_producer) {
    throw new HttpException(403, 'You are not a producer', 'ROLE_NOT_HELD');
  }
  if (role === ROLES.ROASTER && !user.is_roaster) {
    throw new HttpException(403, 'You are not a roaster', 'ROLE_NOT_HELD');
  }
}

async function balanceForRole(role: SelfClaimableRole, address: string): Promise<bigint> {
  const distribution = contractFactory.getDistributionService();
  switch (role) {
    case ROLES.CONSUMER:
      return distribution.coffeeLoverClaimBalance(address);
    case ROLES.PRODUCER:
      return distribution.producerClaimBalance(address);
    case ROLES.ROASTER:
      return distribution.roasterClaimBalance(address);
  }
}

export interface RoleBalance {
  role: SelfClaimableRole;
  /** En stroops, como el resto de la API. */
  balance: string;
  /** El mismo monto en USD, para no hacer la conversión en el frontend. */
  usd: number;
}

/**
 * Saldos de reparto del usuario, por cada rol que tiene.
 *
 * Devuelve siempre CONSUMER (todo el que compró acumula como coffee lover) y
 * suma PRODUCER o ROASTER según corresponda.
 */
export async function getClaimBalances(
  address: string,
  user: { is_producer: boolean; is_roaster: boolean }
): Promise<RoleBalance[]> {
  const roles: SelfClaimableRole[] = [ROLES.CONSUMER];
  if (user.is_producer) roles.push(ROLES.PRODUCER);
  if (user.is_roaster) roles.push(ROLES.ROASTER);

  const balances = await Promise.all(roles.map((role) => balanceForRole(role, address)));

  return roles.map((role, i) => ({
    role,
    balance: balances[i].toString(),
    usd: stroopsToUsd(balances[i]),
  }));
}

export async function getClaimBalance(role: ROLES, address: string): Promise<string> {
  assertSelfClaimable(role);
  return (await balanceForRole(role, address)).toString();
}

/**
 * Transacción para que el usuario reclame su parte del reparto.
 *
 * La firma el usuario, no el backend: el contrato le transfiere el USDC al
 * `caller`, así que tiene que ser él quien autorice.
 */
export async function claimTx(role: ROLES, address: string): Promise<PreparedTransaction> {
  assertSelfClaimable(role);

  const balance = await balanceForRole(role, address);
  if (balance <= 0n) {
    throw new HttpException(400, 'No tokens to claim', 'NO_TOKENS_TO_CLAIM');
  }

  return contractFactory.getMarketplaceService().withdrawDistributionBalance(address, role);
}

/**
 * Cierra el reclamo: envía el sobre firmado y revalida contra la cadena que el
 * saldo quedó en 0, igual que hace el claim del vendedor.
 */
export async function submitClaim(
  role: ROLES,
  address: string,
  signedXdr: string
): Promise<string> {
  assertSelfClaimable(role);

  const { hash } = await contractFactory.getTxSubmitter().submitSigned(signedXdr);

  const balance = await balanceForRole(role, address);
  if (balance !== 0n) {
    throw new HttpException(
      500,
      'Distribution claim balance is not 0 after the claim',
      'CLAIM_BALANCE_NOT_0'
    );
  }

  logger.info({ role, address, hash }, 'Distribution balance claimed');
  return hash;
}
