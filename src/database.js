import fs from 'fs';
import path from 'path';

/**
 * Hybrid Database Adapter (JSON + MongoDB)
 * Automatically switches to MongoDB if MONGO_URL is present and mongoose is installed.
 * Otherwise, falls back to the robust JSON file system.
 */
class HybridDB {
    constructor(dataDir = './database') {
        this.dataDir = dataDir;
        this.collections = new Map();
        this.type = 'json'; // default
        this.mongoose = null;
        this.isConnected = false;

        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }
    }

    async connect() {
        // 1. Try MongoDB
        if (process.env.MONGO_URL) {
            try {
                // Dynamic import to avoid crash if mongoose is not installed
                this.mongoose = (await import('mongoose')).default;
                await this.mongoose.connect(process.env.MONGO_URL);
                this.type = 'mongo';
                this.isConnected = true;
                console.log('🍃 Connected to MongoDB!');
                return;
            } catch (e) {
                console.warn('⚠️ MongoDB Error (Using Fallback):', e.message);
            }
        }

        // 2. Try PostgreSQL
        const pgUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;
        if (pgUrl) {
            try {
                const { Pool } = (await import('pg')).default;
                this.pool = new Pool({ connectionString: pgUrl, ssl: { rejectUnauthorized: false } });
                await this.pool.query('SELECT 1'); // Test connection

                // Create generic KV table
                await this.pool.query(`
                    CREATE TABLE IF NOT EXISTS kv_store (
                        collection TEXT,
                        key TEXT,
                        value JSONB,
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        PRIMARY KEY (collection, key)
                    );
                `);

                this.type = 'postgres';
                this.isConnected = true;
                console.log('🐘 Connected to PostgreSQL!');
                return;
            } catch (pgErr) {
                console.warn('⚠️ Postgres Error (Using Fallback):', pgErr.message);
            }
        }

        // 3. Fallback
        console.log('📦 Using Local JSON Database');
        this.type = 'json';
    }

    collection(name) {
        if (!this.collections.has(name)) {
            if (this.type === 'mongo' && this.isConnected) {
                this.collections.set(name, new MongoCollection(name, this.mongoose));
            } else if (this.type === 'postgres' && this.isConnected) {
                this.collections.set(name, new PostgresCollection(name, this.pool));
            } else {
                const colPath = path.join(this.dataDir, `${name}.json`);
                this.collections.set(name, new JsonCollection(name, colPath));
            }
        }
        return this.collections.get(name);
    }
}

// ═══════════════════════════════════════════════════════════════
// 1. JSON STRATEGY (File System)
// ═══════════════════════════════════════════════════════════════
class JsonCollection {
    constructor(name, filePath) {
        this.name = name;
        this.filePath = filePath;
        this.data = {};
        this.saveTimer = null;
        this.isSaving = false;
        this.load();
    }

    load() {
        if (fs.existsSync(this.filePath)) {
            try {
                this.data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
            } catch (e) {
                this.data = {};
            }
        }
    }

    // Async Debounced Save
    save() {
        if (this.saveTimer) clearTimeout(this.saveTimer);

        this.saveTimer = setTimeout(async () => {
            if (this.isSaving) {
                this.save(); // Retry later if currently writing
                return;
            }

            this.isSaving = true;
            try {
                const tempPath = `${this.filePath}.tmp`;
                await fs.promises.writeFile(tempPath, JSON.stringify(this.data, null, 2));
                await fs.promises.rename(tempPath, this.filePath);
            } catch (e) {
                console.error(`DB: Save failed for ${this.name}`, e);
            } finally {
                this.isSaving = false;
            }
        }, 1000); // Debounce delay 1s
    }

    async get(id) {
        return this.data[id];
    }

    async set(id, value) {
        this.data[id] = value;
        this.save();
        return value;
    }

    async update(id, updateFn) {
        const current = this.data[id] || {};
        const newValue = updateFn(current);
        this.data[id] = newValue;
        this.save();
        return newValue;
    }

    async delete(id) {
        delete this.data[id];
        this.save();
    }
}

// ═══════════════════════════════════════════════════════════════
// 2. MONGO STRATEGY (Mongoose)
// ═══════════════════════════════════════════════════════════════
class MongoCollection {
    constructor(name, mongoose) {
        this.name = name;
        // valid schema, flexible
        const schema = new mongoose.Schema({
            _id: String,
            data: mongoose.Schema.Types.Mixed
        }, { versionKey: false, timestamps: true });

        // usage of 'models' prevents overwrite error during hot reload
        this.Model = mongoose.models[name] || mongoose.model(name, schema);
    }

    async get(id) {
        const doc = await this.Model.findById(id);
        return doc ? doc.data : undefined;
    }

    async set(id, value) {
        await this.Model.findByIdAndUpdate(id, { data: value }, { upsert: true, new: true });
        return value;
    }

    async update(id, updateFn) {
        const doc = await this.Model.findById(id);
        const current = doc ? doc.data : {};
        const newValue = updateFn(current);
        await this.set(id, newValue);
        return newValue;
    }

    async delete(id) {
        await this.Model.findByIdAndDelete(id);
    }
}

// ═══════════════════════════════════════════════════════════════
// 3. POSTGRES STRATEGY (pg)
// ═══════════════════════════════════════════════════════════════
class PostgresCollection {
    constructor(name, pool) {
        this.name = name;
        this.pool = pool;
    }

    async get(id) {
        const res = await this.pool.query(
            'SELECT value FROM kv_store WHERE collection = $1 AND key = $2',
            [this.name, id]
        );
        return res.rows[0]?.value;
    }

    async set(id, value) {
        await this.pool.query(
            `INSERT INTO kv_store (collection, key, value) 
             VALUES ($1, $2, $3)
             ON CONFLICT (collection, key) 
             DO UPDATE SET value = $3, updated_at = CURRENT_TIMESTAMP`,
            [this.name, id, JSON.stringify(value)]
        );
        return value;
    }

    async update(id, updateFn) {
        const current = (await this.get(id)) || {};
        const newValue = updateFn(current);
        await this.set(id, newValue);
        return newValue;
    }

    async delete(id) {
        await this.pool.query(
            'DELETE FROM kv_store WHERE collection = $1 AND key = $2',
            [this.name, id]
        );
    }
}

export const db = new HybridDB(path.join(process.cwd(), 'database'));
export default db;
