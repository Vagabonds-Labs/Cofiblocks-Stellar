/**
 * Test staff accounts for the scripts: a fresh Stellar keypair, funded, with
 * a pilot role granted on chain like the admin screen does.
 */
import { Keypair } from '@stellar/stellar-sdk';
import { StaffRole } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import * as UsersService from '@/services/app/UsersService';
import { ensureAccount } from '@/services/onchain/OnChainAccountsService';

/** A Collector of `coopCode` (at `centerName`, or its first center). */
export async function createCollector(coopCode: string, centerName: string | null, label = 'Script collector') {
  const coop = await prisma.organization.findUniqueOrThrow({
    where: { code: coopCode },
    include: { collectionCenters: true },
  });
  const center = centerName
    ? coop.collectionCenters.find((c) => c.name.toLowerCase() === centerName.toLowerCase())
    : coop.collectionCenters[0];
  if (!center) throw new Error(`No collection center ${centerName} in ${coopCode}`);

  const keypair = Keypair.random();
  await ensureAccount(keypair.publicKey());
  const user = await prisma.user.create({
    data: {
      name: `${label} ${coopCode} ${new Date().toISOString().slice(0, 16)}`,
      walletAddress: keypair.publicKey(),
      walletProvider: 'test-script',
    },
  });
  const { tx_hash } = await UsersService.assignRole(user.id, StaffRole.COLLECTOR, coop.id, center.id);
  return { keypair, user, coop, center, roleTx: tx_hash };
}

/**
 * A staff member with any other role: of cooperative `coopCode`, or of the
 * union for the Export Manager.
 */
export async function createStaff(role: StaffRole, coopCode: string, label = 'Script') {
  const org =
    role === StaffRole.EXPORT_MANAGER
      ? await prisma.organization.findFirstOrThrow({ where: { kind: 'UNION' } })
      : await prisma.organization.findUniqueOrThrow({ where: { code: coopCode } });
  const keypair = Keypair.random();
  await ensureAccount(keypair.publicKey());
  const user = await prisma.user.create({
    data: {
      name: `${label} ${role.toLowerCase()} ${org.code} ${new Date().toISOString().slice(0, 16)}`,
      walletAddress: keypair.publicKey(),
      walletProvider: 'test-script',
    },
  });
  const { tx_hash } = await UsersService.assignRole(user.id, role, org.id);
  return { keypair, user, role, org, roleTx: tx_hash };
}
