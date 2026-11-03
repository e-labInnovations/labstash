import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parts_rels" DROP CONSTRAINT "parts_rels_media_fk";
  
  DROP INDEX "parts_rels_media_id_idx";
  ALTER TABLE "media" ADD COLUMN "part_id" uuid;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail_url" varchar;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail_width" numeric;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail_height" numeric;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail_mime_type" varchar;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail_filesize" numeric;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail_filename" varchar;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail_prefix" varchar;
  ALTER TABLE "media" ADD COLUMN "variants_thumbnail__objectkey" varchar;
  ALTER TABLE "media" ADD CONSTRAINT "media_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "media_part_idx" ON "media" USING btree ("part_id");
  CREATE INDEX "media_variants_thumbnail_variants_thumbnail_filename_idx" ON "media" USING btree ("variants_thumbnail_filename");
  ALTER TABLE "parts_rels" DROP COLUMN "media_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "media" DROP CONSTRAINT "media_part_id_parts_id_fk";
  
  DROP INDEX "media_part_idx";
  DROP INDEX "media_variants_thumbnail_variants_thumbnail_filename_idx";
  ALTER TABLE "parts_rels" ADD COLUMN "media_id" uuid;
  ALTER TABLE "parts_rels" ADD CONSTRAINT "parts_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "parts_rels_media_id_idx" ON "parts_rels" USING btree ("media_id");
  ALTER TABLE "media" DROP COLUMN "part_id";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail_url";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail_width";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail_height";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail_mime_type";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail_filesize";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail_filename";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail_prefix";
  ALTER TABLE "media" DROP COLUMN "variants_thumbnail__objectkey";`)
}
