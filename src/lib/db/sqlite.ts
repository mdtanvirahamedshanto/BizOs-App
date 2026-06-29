import * as SQLite from 'expo-sqlite';

/**
 * SQLite Local Database Manager.
 * Orchestrates schemas, indexes, and migrations for offline-first workflows.
 */

export const DATABASE_NAME = 'bizos.db';

/**
 * Adds a column to an existing table if it is not already present.
 * Idempotent — swallows the "duplicate column name" error.
 */
async function addColumnIfMissing(
  db: SQLite.SQLiteDatabase,
  table: string,
  column: string,
  definition: string,
): Promise<void> {
  try {
    const cols = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
    if (cols.some((c) => c.name === column)) return;
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
  } catch (err) {
    console.warn(`[SQLite] Migration skipped for ${table}.${column}:`, (err as Error)?.message);
  }
}

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
        barcode TEXT,
        name TEXT NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0,
        priceCents INTEGER NOT NULL DEFAULT 0,
        costPriceCents INTEGER NOT NULL DEFAULT 0,
        lowStockThreshold INTEGER NOT NULL DEFAULT 10,
        lastUpdated INTEGER NOT NULL
      );

      -- B. Customer Registry Table
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        dueCents INTEGER NOT NULL DEFAULT 0,
        creditLimitCents INTEGER NOT NULL DEFAULT 0,
        khataAccountId TEXT, -- backend khata account id (needed to sync collections)
        lastUpdated INTEGER NOT NULL DEFAULT 0
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

      -- E. Purchases Record
      CREATE TABLE IF NOT EXISTS purchases (
        id TEXT PRIMARY KEY NOT NULL,
        supplierId TEXT,
        referenceNumber TEXT NOT NULL,
        totalCents INTEGER NOT NULL,
        taxCents INTEGER NOT NULL DEFAULT 0,
        discountCents INTEGER NOT NULL DEFAULT 0,
        paymentStatus TEXT NOT NULL, -- 'PAID' | 'DUE' | 'PARTIAL'
        isSynced INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL
      );

      -- F. Purchase Item Record
      CREATE TABLE IF NOT EXISTS purchase_items (
        id TEXT PRIMARY KEY NOT NULL,
        purchaseId TEXT NOT NULL,
        productId TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        unitCostCents INTEGER NOT NULL,
        FOREIGN KEY(purchaseId) REFERENCES purchases(id) ON DELETE CASCADE,
        FOREIGN KEY(productId) REFERENCES products(id)
      );

      -- G. Expense Categories
      CREATE TABLE IF NOT EXISTS expense_categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        icon TEXT,
        lastUpdated INTEGER NOT NULL DEFAULT 0
      );

      -- H. Expenses Record
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY NOT NULL,
        categoryId TEXT,
        title TEXT NOT NULL,
        description TEXT,
        amountCents INTEGER NOT NULL,
        paymentMethod TEXT,
        isSynced INTEGER NOT NULL DEFAULT 0,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY(categoryId) REFERENCES expense_categories(id)
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

      -- G. Sync Dead-letter Queue
      -- Items the server permanently rejected (4xx). Kept (not silently deleted)
      -- so the failure can be surfaced to the user and inspected/retried later.
      CREATE TABLE IF NOT EXISTS sync_deadletter (
        id TEXT PRIMARY KEY NOT NULL,
        eventType TEXT NOT NULL,
        payload TEXT NOT NULL,
        error TEXT,
        statusCode INTEGER,
        createdAt INTEGER NOT NULL,
        failedAt INTEGER NOT NULL
      );
    `);

    // 2b. Lightweight migrations for databases created by earlier versions.
    // Each ALTER is tolerant of "duplicate column" errors so it is idempotent.
    await addColumnIfMissing(db, 'products', 'barcode', 'TEXT');
    await addColumnIfMissing(db, 'products', 'costPriceCents', 'INTEGER NOT NULL DEFAULT 0');
    await addColumnIfMissing(db, 'products', 'lowStockThreshold', 'INTEGER NOT NULL DEFAULT 10');
    await addColumnIfMissing(db, 'customers', 'khataAccountId', 'TEXT');
    await addColumnIfMissing(db, 'customers', 'lastUpdated', 'INTEGER NOT NULL DEFAULT 0');

    // 3. Create Indexes for query optimizations during cashier scanning and ledger searches
    await db.execAsync(`
      CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
      CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
      CREATE INDEX IF NOT EXISTS idx_sales_synced ON sales(isSynced);
      CREATE INDEX IF NOT EXISTS idx_cashbook_synced ON cashbook_entries(isSynced);
      CREATE INDEX IF NOT EXISTS idx_outbox_created ON sync_outbox(createdAt);
    `);

    // 4. Seed sample data for local development ONLY. Production builds must
    // start empty and hydrate exclusively from the server (pull-sync). Demo
    // rows use non-UUID ids and `isSynced=1`, which would otherwise corrupt
    // dashboards/reports and break sync against the backend.
    if (__DEV__) {
    const productCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM products');
    if (productCountRow && productCountRow.count === 0) {
      console.log('[SQLite] Seeding sample products...');
      const now = Date.now();
      await db.runAsync(
        `INSERT INTO products (id, sku, name, stock, priceCents, lastUpdated) VALUES
         ('prod-1', '1001', 'Miniket Rice 1kg / মিনিকেট চাল ১ কেজি', 50, 6800, ?),
         ('prod-2', '1002', 'Aarong Liquid Milk 1L / আড়ং তরল দুধ ১ লিটার', 15, 9000, ?),
         ('prod-3', '1003', 'Farm Eggs 1 Dozen / ফার্মের ডিম ১ ডজন', 20, 14500, ?),
         ('prod-4', '1004', 'Rupchanda Soybean Oil 2L / রূপচাঁদা সয়াবিন তেল ২ লিটার', 8, 38000, ?),
         ('prod-5', '1005', 'Coca-Cola 500ml / কোকা-কোলা ৫০০ মিলি', 4, 5000, ?)`,
        [now, now, now, now, now]
      );
      // Use SKU as the default barcode for seeded demo products.
      await db.runAsync('UPDATE products SET barcode = sku WHERE barcode IS NULL');
    }

    const customerCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM customers');
    if (customerCountRow && customerCountRow.count === 0) {
      console.log('[SQLite] Seeding sample customers...');
      await db.runAsync(`
        INSERT INTO customers (id, name, phone, dueCents, creditLimitCents) VALUES
        ('cust-1', 'Abul Kashem / আবুল কাশেম', '+8801700000001', 150000, 500000),
        ('cust-2', 'Kamal Uddin / কামাল উদ্দিন', '+8801800000002', 450000, 300000),
        ('cust-3', 'Sujon Ahmed / সুজন আহমেদ', '+8801900000003', 85000, 200000)
      `);
    }

    const salesCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM sales');
    if (salesCountRow && salesCountRow.count === 0) {
      console.log('[SQLite] Seeding sample sales...');
      const now = Date.now();
      await db.runAsync(
        `INSERT INTO sales (id, customerId, totalCents, taxCents, discountCents, paymentStatus, isSynced, createdAt) VALUES
         ('sale-mock-1', NULL, 25000, 0, 0, 'PAID', 1, ?),
         ('sale-mock-2', NULL, 42000, 0, 0, 'PAID', 1, ?)`,
        [now - 3600000, now - 7200000]
      );

      await db.runAsync(`
        INSERT INTO sale_items (id, saleId, productId, quantity, priceCents) VALUES
        ('si-1', 'sale-mock-1', 'prod-1', 2, 6800),
        ('si-2', 'sale-mock-1', 'prod-2', 1, 9000),
        ('si-3', 'sale-mock-2', 'prod-3', 2, 14500),
        ('si-4', 'sale-mock-2', 'prod-5', 2, 5000)
      `);
    }

    const cashbookCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM cashbook_entries');
    if (cashbookCountRow && cashbookCountRow.count === 0) {
      console.log('[SQLite] Seeding sample cashbook entries...');
      const now = Date.now();
      await db.runAsync(
        `INSERT INTO cashbook_entries (id, type, amountCents, description, source, reference, isSynced, createdAt) VALUES
         ('cb-mock-1', 'IN', 1000000, 'প্রারম্ভিক ক্যাশ / Opening Balance', 'MANUAL', 'OP-001', 1, ?),
         ('cb-mock-2', 'OUT', 120000, 'দোকান ভাড়া / Shop Rent', 'MANUAL', 'RENT-01', 1, ?),
         ('cb-mock-3', 'IN', 25000, 'POS Sale [sale-mock-1]', 'SALE', 'sale-mock-1', 1, ?),
         ('cb-mock-4', 'IN', 42000, 'POS Sale [sale-mock-2]', 'SALE', 'sale-mock-2', 1, ?)`,
        [now - 86400000, now - 18000000, now - 3600000, now - 7200000]
      );
    }

    const purchasesCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM purchases');
    if (purchasesCountRow && purchasesCountRow.count === 0) {
      console.log('[SQLite] Seeding sample purchases...');
      const now = Date.now();
      await db.runAsync(
        `INSERT INTO purchases (id, supplierId, referenceNumber, totalCents, taxCents, discountCents, paymentStatus, isSynced, createdAt) VALUES
         ('purch-mock-1', NULL, 'INV-2023-001', 150000, 0, 0, 'PAID', 1, ?),
         ('purch-mock-2', NULL, 'INV-2023-002', 32000, 0, 0, 'DUE', 1, ?)`,
        [now - 5000000, now - 10000000]
      );
    }

    const expCatCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM expense_categories');
    if (expCatCountRow && expCatCountRow.count === 0) {
      console.log('[SQLite] Seeding sample expense categories...');
      await db.runAsync(`
        INSERT INTO expense_categories (id, name, color, icon, lastUpdated) VALUES
        ('cat-1', 'দোকান ভাড়া / Rent', '#eab308', 'home', 0),
        ('cat-2', 'বিদ্যুৎ বিল / Electricity', '#3b82f6', 'zap', 0),
        ('cat-3', 'যাতায়াত / Transport', '#10b981', 'truck', 0),
        ('cat-4', 'আপ্যায়ন / Entertainment', '#f43f5e', 'coffee', 0)
      `);
    }

    const expCountRow = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM expenses');
    if (expCountRow && expCountRow.count === 0) {
      console.log('[SQLite] Seeding sample expenses...');
      const now = Date.now();
      await db.runAsync(
        `INSERT INTO expenses (id, categoryId, title, description, amountCents, paymentMethod, isSynced, createdAt) VALUES
         ('exp-mock-1', 'cat-1', 'Shop Rent July', 'Paid to landlord', 120000, 'CASH', 1, ?),
         ('exp-mock-2', 'cat-2', 'Electricity Bill', 'For last month', 25000, 'MFS', 1, ?)`,
        [now - 18000000, now - 1200000]
      );
    }
    }

    console.log('[SQLite] Database initialized successfully.');
  } catch (error) {
    console.error('[SQLite] Database initialization failed:', error);
    throw error;
  }
}
