// Web fallback: in-memory store (expo-sqlite doesn't support web)
const memoryStore: Record<string, any[]> = {};

function getMemTable(table: string): any[] {
  if (!memoryStore[table]) memoryStore[table] = [];
  return memoryStore[table];
}

export async function initDatabase(): Promise<void> {
  // No-op on web
}

export async function insertRecord(table: string, record: Record<string, any>): Promise<void> {
  const arr = getMemTable(table);
  const idx = arr.findIndex((r: any) => r.id === record.id);
  if (idx >= 0) arr[idx] = record;
  else arr.push(record);
}

export async function getRecords(table: string, options?: {
  where?: string;
  args?: any[];
  orderBy?: string;
  limit?: number;
}): Promise<any[]> {
  let arr = [...getMemTable(table)];
  if (options?.orderBy?.includes('DESC')) arr.reverse();
  if (options?.limit) arr = arr.slice(0, options.limit);
  return arr;
}

export async function deleteRecord(table: string, id: string): Promise<void> {
  const arr = getMemTable(table);
  const idx = arr.findIndex((r: any) => r.id === id);
  if (idx >= 0) arr.splice(idx, 1);
}

export async function getRecordsByDate(table: string, date: Date): Promise<any[]> {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return getMemTable(table).filter((r: any) => {
    const d = new Date(r.date);
    return d >= start && d < end;
  });
}
