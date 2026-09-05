-- Safe additive migration: preserve every existing row and attach it to one store.
CREATE TABLE IF NOT EXISTS "stores" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO "stores" ("id", "name") VALUES ('default-store', 'ORANGE');

ALTER TABLE "users" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "audit_logs" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "products" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "variants" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "shifts" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "sales" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "sale_items" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "expenses" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "receipt_templates" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "barcode_label_templates" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "suppliers" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "purchase_invoices" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "purchase_invoice_items" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "supplier_payments" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "stock_movements" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "store_settings" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "customers" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';
ALTER TABLE "customer_payments" ADD COLUMN "storeId" TEXT NOT NULL DEFAULT 'default-store';

CREATE INDEX IF NOT EXISTS "users_storeId_idx" ON "users" ("storeId");
CREATE INDEX IF NOT EXISTS "products_storeId_idx" ON "products" ("storeId");
CREATE INDEX IF NOT EXISTS "sales_storeId_idx" ON "sales" ("storeId");
CREATE INDEX IF NOT EXISTS "customers_storeId_idx" ON "customers" ("storeId");
CREATE INDEX IF NOT EXISTS "suppliers_storeId_idx" ON "suppliers" ("storeId");
