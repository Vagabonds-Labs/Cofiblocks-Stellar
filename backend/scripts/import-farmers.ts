/**
 * Imports a cooperative's farmer list from a CSV, the same as the admin
 * screen does (POST /api/admin/farmers/import).
 *
 *   npm run farmers:import -- farmers.csv            # validates and shows what it would do
 *   npm run farmers:import -- farmers.csv --apply    # writes
 *
 * Columns: coop_code, farmer_id (required), full_name, phone,
 * collection_center. Idempotent: importing the same file again changes
 * nothing. Uses DATABASE_URL from .env.
 */
import 'dotenv/config';
import { readFileSync } from 'fs';

import { prisma } from '@/lib/prisma';
import { importFarmersCsv } from '@/services/app/FarmersService';

async function main() {
  const file = process.argv.slice(2).find((arg) => !arg.startsWith('--'));
  if (!file) {
    console.error('Usage: npm run farmers:import -- <file.csv> [--apply]');
    process.exit(1);
  }
  const apply = process.argv.includes('--apply');
  const result = await importFarmersCsv(readFileSync(file, 'utf8'), !apply);

  for (const error of result.errors) console.error(`  line ${error.line}: ${error.message}`);
  console.log(
    `${apply && result.errors.length === 0 ? 'Imported' : 'Dry run'}: ${result.created} new, ${result.updated} updated, ${result.unchanged} unchanged, ${result.errors.length} errors`
  );
  if (!apply && result.errors.length === 0) console.log('Run again with --apply to write.');
  await prisma.$disconnect();
  if (result.errors.length > 0) process.exit(1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
