/*
  Warnings:

  - You are about to drop the column `logoUrl` on the `Workspace` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[inviteCode]` on the table `Workspace` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Workspace" DROP COLUMN "logoUrl",
ADD COLUMN     "inviteCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_inviteCode_key" ON "Workspace"("inviteCode");
