-- AlterTable: password_hash becomes optional (Google-only accounts have none),
-- plus Google account linking and login-attempt lockout counters.
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;
ALTER TABLE "users" ADD COLUMN     "google_id" TEXT;
ALTER TABLE "users" ADD COLUMN     "failed_login_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN     "locked_until" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
