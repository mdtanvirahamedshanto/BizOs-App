import * as SQLite from 'expo-sqlite';

/**
 * SQLite Local Database Manager.
 * Orchestrates schemas, indexes, and migrations for offline-first workflows.
 */

export const DATABASE_NAME = 'bizos.db';

export async function initializeDatabase(db: SQLite.SQLiteDatabase): Promise<void> {
  try {
    // 1. Enable Foreign Key Constraints for relational integrity
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // 2. Create Schema Tables
    await db.execAsync(`
      -- A. Product Cache Table
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        sku TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        priceCents INTEGER NOT NULL DEFAULT 0,
        lastUpdated INTEGER NOT NULL
      );

      -- B. Customer Registry Table
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        dueCents INTEGER NOT NULL DEFAULT 0,
        creditLimitCents INTEGER NOT NULL DEFAULT 0
      );

      -- C. Sales Record (Master)
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY NOT NULL,
        customerId TEXT,
        totalCents INTEGER NOT NULL,
        taxCents INTEGER NOT NULL DEFAULT 0,
        discountCents INTEGER NOT NULL DEFAULT 0,
        paymentStatus TEXT NOT NULL, -- 'PAID' | 'DUE' | 'PARTIAL'
        isSynced INTEGER NOT NULL DEFAULT 0, -- 0 = Offline Draft, 1 = Pushed to cloud
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(customerId) REFERENCES customers(id)
      );

      -- D. Sale Item Record (Detail)
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY NOT NULL,
        saleId TEXT NOT NULL,
        productId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        priceCents INTEGER NOT NULL,
        FOREIGN KEY(saleId) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY(productId) REFERENCES products(id)
      );

      -- E. Cashbook Registry Table
      CREATE TABLE IF NOT EXISTS cashbook_entries (
        id TEXT PRIMARY KEY NOT NULL,
        type TEXT NOT NULL, -- 'IN' | 'OUT'
        amountCents INTEGER NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL, -- 'MANUAL' | 'SALE' | 'EXPENSE'
        reference TEXT,
        isSynced INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL
      );

      -- F. Sync Engine Outbox Queue
      CREATE TABLE IF NOT EXISTS sync_outbox (
        id TEXT PRIMARY KEY NOT NULL,
        eventType TEXT NOT NULL, -- 'CREATE_SALE' | 'CASHBOOK_IN' | 'CASHBOOK_OUT'
        payload TEXT NOT NULL, -- JSON Payload to send to server
        isProcessing INTEGER NOT NULL DEFAULT 0, -- 1 = Lock for active upload
        createdAt INTEGER NOT NULL
      );
    `);

    // 3. Create Indexes for query optimizations during cashier scanning and ledger searches
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(isSynced);
      CREATE INDEX IF NOT EXISTS idx_cashbook_synced ON cashbook_entries(isSynced);
      CREATE INDEX IF NOT EXISTS idx_outbox_created ON sync_outbox(createdAt);
    `);

    console.log('[SQLite] Database initialized successfully.');
  } catch (error) {
    console.error('[SQLite] Database initialization failed:', error);
    throw error;
  }
}
