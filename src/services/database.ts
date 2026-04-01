import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase;

export async function initDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync('fitness.db');
  
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS weight_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      weight REAL NOT NULL,
      bodyFatPercent REAL,
      muscleMass REAL,
      visceralFat REAL,
      waistCircumference REAL,
      note TEXT
    );
    
    CREATE TABLE IF NOT EXISTS meal_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      mealType TEXT NOT NULL,
      foods TEXT NOT NULL,
      note TEXT
    );
    
    CREATE TABLE IF NOT EXISTS exercise_records (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      type TEXT NOT NULL,
      durationMinutes INTEGER NOT NULL,
      caloriesBurned REAL,
      note TEXT
    );
    
    CREATE TABLE IF NOT EXISTS training_sessions (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      exercises TEXT NOT NULL,
      durationMinutes INTEGER,
      note TEXT
    );
    
    CREATE TABLE IF NOT EXISTS daily_recovery (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      energyLevel INTEGER NOT NULL,
      sorenessLevel INTEGER NOT NULL,
      sleepQuality INTEGER NOT NULL,
      stressLevel INTEGER NOT NULL,
      sleepHours REAL,
      note TEXT
    );
  `);
}

export function getDb(): SQLite.SQLiteDatabase {
  return db;
}

// Generic CRUD helpers
export async function insertRecord(table: string, record: Record<string, any>): Promise<void> {
  const keys = Object.keys(record);
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => record[k]);
  await db.runAsync(
    `INSERT OR REPLACE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`,
    values
  );
}

export async function getRecords(table: string, options?: {
  where?: string;
  args?: any[];
  orderBy?: string;
  limit?: number;
}): Promise<any[]> {
  let query = `SELECT * FROM ${table}`;
  const args: any[] = options?.args ?? [];
  if (options?.where) query += ` WHERE ${options.where}`;
  if (options?.orderBy) query += ` ORDER BY ${options.orderBy}`;
  if (options?.limit) query += ` LIMIT ${options.limit}`;
  return db.getAllAsync(query, args);
}

export async function deleteRecord(table: string, id: string): Promise<void> {
  await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

export async function getRecordsByDate(table: string, date: Date): Promise<any[]> {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).toISOString();
  return db.getAllAsync(
    `SELECT * FROM ${table} WHERE date >= ? AND date < ? ORDER BY date DESC`,
    [start, end]
  );
}
