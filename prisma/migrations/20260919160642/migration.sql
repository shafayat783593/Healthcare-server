/*
  Warnings:

  - The values [APPORVED] on the enum `DoctorCertificationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DoctorCertificationStatus_new" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
ALTER TABLE "public"."doctors" ALTER COLUMN "verificationStatus" DROP DEFAULT;
ALTER TABLE "doctors" ALTER COLUMN "verificationStatus" TYPE "DoctorCertificationStatus_new" USING ("verificationStatus"::text::"DoctorCertificationStatus_new");
ALTER TYPE "DoctorCertificationStatus" RENAME TO "DoctorCertificationStatus_old";
ALTER TYPE "DoctorCertificationStatus_new" RENAME TO "DoctorCertificationStatus";
DROP TYPE "public"."DoctorCertificationStatus_old";
ALTER TABLE "doctors" ALTER COLUMN "verificationStatus" SET DEFAULT 'PENDING';
COMMIT;
