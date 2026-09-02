/*
  Warnings:

  - You are about to drop the column `date` on the `cofiblocks_events` table. All the data in the column will be lost.
  - Added the required column `end_at` to the `cofiblocks_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `start_at` to the `cofiblocks_events` table without a default value. This is not possible if the table is not empty.
  - Added the required column `timezone` to the `cofiblocks_events` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "cofiblocks_events" DROP COLUMN "date",
ADD COLUMN     "end_at" TIMESTAMPTZ NOT NULL,
ADD COLUMN     "is_all_day" BOOLEAN,
ADD COLUMN     "start_at" TIMESTAMPTZ NOT NULL,
ADD COLUMN     "timezone" TEXT NOT NULL;
