import { type MigrateUpArgs, type MigrateDownArgs, sql } from '@payloadcms/db-vercel-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'user');
  CREATE TABLE "users_labs" (
  	"_order" integer NOT NULL,
  	"_parent_id" uuid NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"lab_id" uuid NOT NULL
  );
  
  CREATE TABLE "labs" (
  	"id" uuid PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "labs_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" uuid NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" uuid
  );
  
  DROP INDEX "purchases_external_id_idx";
  DROP INDEX "supplier_sku_idx";
  DROP INDEX "locations_code_idx";
  ALTER TABLE "parts" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "stock" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "stock_movements" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "locations" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "purchases" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "purchase_lines" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "supplier_parts" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "media" ADD COLUMN "lab_id" uuid;
  ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" DEFAULT 'user' NOT NULL;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "labs_id" uuid;
  ALTER TABLE "users_labs" ADD CONSTRAINT "users_labs_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "users_labs" ADD CONSTRAINT "users_labs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "labs_rels" ADD CONSTRAINT "labs_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."labs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "labs_rels" ADD CONSTRAINT "labs_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_labs_order_idx" ON "users_labs" USING btree ("_order");
  CREATE INDEX "users_labs_parent_id_idx" ON "users_labs" USING btree ("_parent_id");
  CREATE INDEX "users_labs_lab_idx" ON "users_labs" USING btree ("lab_id");
  CREATE INDEX "labs_updated_at_idx" ON "labs" USING btree ("updated_at");
  CREATE INDEX "labs_created_at_idx" ON "labs" USING btree ("created_at");
  CREATE INDEX "labs_rels_order_idx" ON "labs_rels" USING btree ("order");
  CREATE INDEX "labs_rels_parent_idx" ON "labs_rels" USING btree ("parent_id");
  CREATE INDEX "labs_rels_path_idx" ON "labs_rels" USING btree ("path");
  CREATE INDEX "labs_rels_users_id_idx" ON "labs_rels" USING btree ("users_id");
  ALTER TABLE "parts" ADD CONSTRAINT "parts_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock" ADD CONSTRAINT "stock_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "locations" ADD CONSTRAINT "locations_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "purchases" ADD CONSTRAINT "purchases_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "purchase_lines" ADD CONSTRAINT "purchase_lines_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "supplier_parts" ADD CONSTRAINT "supplier_parts_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_lab_id_labs_id_fk" FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_labs_fk" FOREIGN KEY ("labs_id") REFERENCES "public"."labs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "parts_lab_idx" ON "parts" USING btree ("lab_id");
  CREATE INDEX "stock_lab_idx" ON "stock" USING btree ("lab_id");
  CREATE INDEX "stock_movements_lab_idx" ON "stock_movements" USING btree ("lab_id");
  CREATE INDEX "locations_lab_idx" ON "locations" USING btree ("lab_id");
  CREATE UNIQUE INDEX "lab_code_idx" ON "locations" USING btree ("lab_id","code");
  CREATE INDEX "purchases_lab_idx" ON "purchases" USING btree ("lab_id");
  CREATE UNIQUE INDEX "lab_externalId_idx" ON "purchases" USING btree ("lab_id","external_id");
  CREATE INDEX "purchase_lines_lab_idx" ON "purchase_lines" USING btree ("lab_id");
  CREATE INDEX "supplier_parts_lab_idx" ON "supplier_parts" USING btree ("lab_id");
  CREATE UNIQUE INDEX "lab_supplier_sku_idx" ON "supplier_parts" USING btree ("lab_id","supplier_id","sku");
  CREATE INDEX "media_lab_idx" ON "media" USING btree ("lab_id");
  CREATE INDEX "payload_locked_documents_rels_labs_id_idx" ON "payload_locked_documents_rels" USING btree ("labs_id");
  CREATE INDEX "locations_code_idx" ON "locations" USING btree ("code");`)

  // An existing install becomes one lab: everything so far is the first user's, and the
  // people already signed up run it. A fresh database has no users and gets no lab here.
  await db.execute(sql`
  DO $$
  DECLARE first_lab uuid;
  BEGIN
    IF EXISTS (SELECT 1 FROM "users") THEN
      first_lab := gen_random_uuid();
      INSERT INTO "labs" ("id", "name") VALUES (first_lab, 'Ashad''s lab');
      UPDATE "parts" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "stock" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "stock_movements" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "locations" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "purchases" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "purchase_lines" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "supplier_parts" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "media" SET "lab_id" = first_lab WHERE "lab_id" IS NULL;
      UPDATE "users" SET "role" = 'admin';
      INSERT INTO "users_labs" ("_order", "_parent_id", "id", "lab_id")
        SELECT 1, "id", substr(md5(random()::text), 1, 24), first_lab FROM "users";
    END IF;
  END $$;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "users_labs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "labs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "labs_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "users_labs" CASCADE;
  DROP TABLE "labs" CASCADE;
  DROP TABLE "labs_rels" CASCADE;
  ALTER TABLE "parts" DROP CONSTRAINT "parts_lab_id_labs_id_fk";
  
  ALTER TABLE "stock" DROP CONSTRAINT "stock_lab_id_labs_id_fk";
  
  ALTER TABLE "stock_movements" DROP CONSTRAINT "stock_movements_lab_id_labs_id_fk";
  
  ALTER TABLE "locations" DROP CONSTRAINT "locations_lab_id_labs_id_fk";
  
  ALTER TABLE "purchases" DROP CONSTRAINT "purchases_lab_id_labs_id_fk";
  
  ALTER TABLE "purchase_lines" DROP CONSTRAINT "purchase_lines_lab_id_labs_id_fk";
  
  ALTER TABLE "supplier_parts" DROP CONSTRAINT "supplier_parts_lab_id_labs_id_fk";
  
  ALTER TABLE "media" DROP CONSTRAINT "media_lab_id_labs_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_labs_fk";
  
  DROP INDEX "parts_lab_idx";
  DROP INDEX "stock_lab_idx";
  DROP INDEX "stock_movements_lab_idx";
  DROP INDEX "locations_lab_idx";
  DROP INDEX "lab_code_idx";
  DROP INDEX "purchases_lab_idx";
  DROP INDEX "lab_externalId_idx";
  DROP INDEX "purchase_lines_lab_idx";
  DROP INDEX "supplier_parts_lab_idx";
  DROP INDEX "lab_supplier_sku_idx";
  DROP INDEX "media_lab_idx";
  DROP INDEX "payload_locked_documents_rels_labs_id_idx";
  DROP INDEX "locations_code_idx";
  CREATE UNIQUE INDEX "purchases_external_id_idx" ON "purchases" USING btree ("external_id");
  CREATE UNIQUE INDEX "supplier_sku_idx" ON "supplier_parts" USING btree ("supplier_id","sku");
  CREATE UNIQUE INDEX "locations_code_idx" ON "locations" USING btree ("code");
  ALTER TABLE "parts" DROP COLUMN "lab_id";
  ALTER TABLE "stock" DROP COLUMN "lab_id";
  ALTER TABLE "stock_movements" DROP COLUMN "lab_id";
  ALTER TABLE "locations" DROP COLUMN "lab_id";
  ALTER TABLE "purchases" DROP COLUMN "lab_id";
  ALTER TABLE "purchase_lines" DROP COLUMN "lab_id";
  ALTER TABLE "supplier_parts" DROP COLUMN "lab_id";
  ALTER TABLE "media" DROP COLUMN "lab_id";
  ALTER TABLE "users" DROP COLUMN "role";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "labs_id";
  DROP TYPE "public"."enum_users_role";`)
}
