import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parts" ADD COLUMN "shared" boolean DEFAULT false;
  CREATE INDEX "parts_shared_idx" ON "parts" USING btree ("shared");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "parts_shared_idx";
  ALTER TABLE "parts" DROP COLUMN "shared";`)
}
