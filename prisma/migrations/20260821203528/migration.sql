/*
  Warnings:

  - The values [CANCLLED] on the enum `PaymentStatus` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `update` on the `appointments` table. All the data in the column will be lost.
  - You are about to drop the column `bakshPaymentId` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `bkashTexId` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `gatwayResponse` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `marchantInvoiceNumber` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `payerReferance` on the `payment` table. All the data in the column will be lost.
  - You are about to drop the column `update` on the `payment` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[merchantInvoiceNumber]` on the table `payment` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[bkashPaymentId]` on the table `payment` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `appointments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `merchantInvoiceNumber` to the `payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `payment` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PAID', 'FAILED', 'CANCELLED', 'REFUNDED');
ALTER TABLE "public"."payment" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payment" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "payment" ALTER COLUMN "status" SET DEFAULT 'UNPAID';
COMMIT;

-- DropIndex
DROP INDEX "payment_bakshPaymentId_key";

-- DropIndex
DROP INDEX "payment_marchantInvoiceNumber_key";

-- AlterTable
ALTER TABLE "appointments" DROP COLUMN "update",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "payment" DROP COLUMN "bakshPaymentId",
DROP COLUMN "bkashTexId",
DROP COLUMN "gatwayResponse",
DROP COLUMN "marchantInvoiceNumber",
DROP COLUMN "payerReferance",
DROP COLUMN "update",
ADD COLUMN     "bkashPaymentId" TEXT,
ADD COLUMN     "bkashTrxId" TEXT,
ADD COLUMN     "gatewayResponse" JSONB,
ADD COLUMN     "merchantInvoiceNumber" TEXT NOT NULL,
ADD COLUMN     "payerReference" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "payment_merchantInvoiceNumber_key" ON "payment"("merchantInvoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payment_bkashPaymentId_key" ON "payment"("bkashPaymentId");
