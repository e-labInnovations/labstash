import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_labs_lab_role" AS ENUM('admin', 'member');
  CREATE TYPE "public"."enum_labs_theme" AS ENUM('green', 'blue', 'purple', 'red', 'black', 'white');
  CREATE TABLE "parts_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar NOT NULL,
  	"url" varchar NOT NULL
  );
  
  ALTER TABLE "media" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "media" ALTER COLUMN "kind" SET DEFAULT 'image'::text;
  -- 'kicad' split into symbol and footprint; anything filed under it becomes 'other'
  UPDATE "media" SET "kind" = 'other' WHERE "kind" = 'kicad';
  DROP TYPE "public"."enum_media_kind";
  CREATE TYPE "public"."enum_media_kind" AS ENUM('image', 'datasheet', 'symbol', 'footprint', 'model3d', 'other');
  ALTER TABLE "media" ALTER COLUMN "kind" SET DEFAULT 'image'::"public"."enum_media_kind";
  ALTER TABLE "media" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_media_kind" USING "kind"::"public"."enum_media_kind";
  ALTER TABLE "users_labs" ADD COLUMN "lab_role" "enum_users_labs_lab_role" DEFAULT 'admin';
  ALTER TABLE "labs" ADD COLUMN "theme" "enum_labs_theme" DEFAULT 'green';
  ALTER TABLE "labs" ADD COLUMN "logo_id" uuid;
  ALTER TABLE "parts_links" ADD CONSTRAINT "parts_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "parts_links_order_idx" ON "parts_links" USING btree ("_order");
  CREATE INDEX "parts_links_parent_id_idx" ON "parts_links" USING btree ("_parent_id");
  ALTER TABLE "labs" ADD CONSTRAINT "labs_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "labs_logo_idx" ON "labs" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "parts_links" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "parts_links" CASCADE;
  ALTER TABLE "labs" DROP CONSTRAINT "labs_logo_id_media_id_fk";
  
  ALTER TABLE "media" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "media" ALTER COLUMN "kind" SET DEFAULT 'image'::text;
  DROP TYPE "public"."enum_media_kind";
  CREATE TYPE "public"."enum_media_kind" AS ENUM('image', 'datasheet', 'model3d', 'kicad', 'other');
  ALTER TABLE "media" ALTER COLUMN "kind" SET DEFAULT 'image'::"public"."enum_media_kind";
  ALTER TABLE "media" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_media_kind" USING "kind"::"public"."enum_media_kind";
  DROP INDEX "labs_logo_idx";
  ALTER TABLE "users_labs" DROP COLUMN "lab_role";
  ALTER TABLE "labs" DROP COLUMN "theme";
  ALTER TABLE "labs" DROP COLUMN "logo_id";
  DROP TYPE "public"."enum_users_labs_lab_role";
  DROP TYPE "public"."enum_labs_theme";`)
}
