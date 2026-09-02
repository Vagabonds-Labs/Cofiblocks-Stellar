#!/usr/bin/env node
/**
 * Verifica contra la red las constantes de las que depende la migración.
 * No asume nada: consulta el RPC y simula llamadas reales.
 *
 *   npm  i @stellar/stellar-sdk
 *   node scripts/verify-stellar-constants.mjs
 *
 * Un error de decimales acá es un error de 10x en cada precio del marketplace.
 */
import {
  Asset, Account, BASE_FEE, Contract, Networks,
  TransactionBuilder, rpc, scValToNative,
} from '@stellar/stellar-sdk';

const NETWORKS = [
  {
    name: 'mainnet',
    rpcUrl: process.env.STELLAR_RPC_URL_MAINNET ?? 'https://mainnet.sorobanrpc.com',
    passphrase: Networks.PUBLIC,
    usdcIssuer: 'GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN',
  },
  {
    name: 'testnet',
    rpcUrl: process.env.STELLAR_RPC_URL_TESTNET ?? 'https://soroban-testnet.stellar.org',
    passphrase: Networks.TESTNET,
    usdcIssuer: 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
  },
];

const EXPECTED_DECIMALS = 7;

async function readContract(server, passphrase, source, contractId, fn) {
  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: passphrase })
    .addOperation(contract.call(fn))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim)) {
    throw new Error(`simulate ${fn} falló: ${JSON.stringify(sim.error)}`);
  }
  return scValToNative(sim.result.retval);
}

let failed = false;

for (const net of NETWORKS) {
  console.log(`\n── ${net.name} ─────────────────────────────`);
  try {
    const server = new rpc.Server(net.rpcUrl);

    const info = await server.getNetwork();
    console.log(`  rpc              ${net.rpcUrl}`);
    console.log(`  passphrase       ${info.passphrase}`);
    console.log(`  protocolVersion  ${info.protocolVersion}`);
    if (info.passphrase !== net.passphrase) {
      console.error(`  ✗ passphrase inesperada (esperada: ${net.passphrase})`);
      failed = true;
    }

    const asset = new Asset('USDC', net.usdcIssuer);
    const sac = asset.contractId(net.passphrase);
    console.log(`  USDC issuer      ${net.usdcIssuer}`);
    console.log(`  USDC SAC         ${sac}`);

    // El emisor existe en la red, sirve como source account para simular.
    const source = await server.getAccount(net.usdcIssuer);

    const decimals = await readContract(server, net.passphrase, source, sac, 'decimals');
    const symbol = await readContract(server, net.passphrase, source, sac, 'symbol');
    console.log(`  USDC symbol      ${symbol}`);
    console.log(`  USDC decimals    ${decimals}`);

    if (Number(decimals) !== EXPECTED_DECIMALS) {
      console.error(`  ✗ decimals == ${decimals}, se esperaba ${EXPECTED_DECIMALS}. NO fijar usdToWei sin revisar.`);
      failed = true;
    } else {
      console.log(`  ✓ decimals == ${EXPECTED_DECIMALS} → usdToWei = amount * 10^7`);
    }
  } catch (err) {
    console.error(`  ✗ ${err.message}`);
    failed = true;
  }
}

console.log('');
process.exit(failed ? 1 : 0);
