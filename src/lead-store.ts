import type { StorageAdapter } from "grammy";
import { resolveSessionStorage } from "./toolkit/session/redis.js";

export interface Lead {
  name: string;
  phone: string;
  email: string;
  timestamp: string;
  message: string;
  confirmed: boolean;
  userId: number;
}

interface LeadIndex {
  leadKeys: string[];
}

// The toolkit adapter resolves to Redis in deployment. Keys are addressed through
// an explicit user index; this repository never enumerates the backing keyspace.
const storage: StorageAdapter<Lead | LeadIndex> = resolveSessionStorage<Lead | LeadIndex>(undefined);

export interface DurableLeadStore {
  CHAT_DO?: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(input: string, init?: { method?: string; body?: string }): Promise<Response> };
  };
}

function indexKey(userId: number): string {
  return `lead-index:${userId}`;
}

function leadKey(userId: number, sequence: number): string {
  return `lead:${userId}:${sequence}`;
}

export async function saveLead(lead: Lead, env?: DurableLeadStore): Promise<void> {
  if (env?.CHAT_DO) {
    const stub = env.CHAT_DO.get(env.CHAT_DO.idFromName(`chat:${lead.userId}`));
    await stub.fetch("https://do/lead", { method: "POST", body: JSON.stringify(lead) });
    return;
  }
  const index = (await storage.read(indexKey(lead.userId))) as LeadIndex | undefined;
  const leadKeys = index?.leadKeys ?? [];
  const key = leadKey(lead.userId, leadKeys.length + 1);
  await storage.write(key, lead);
  await storage.write(indexKey(lead.userId), { leadKeys: [...leadKeys, key] });
}

export async function leadsForUser(userId: number): Promise<Lead[]> {
  const index = (await storage.read(indexKey(userId))) as LeadIndex | undefined;
  if (!index) return [];
  const leads = await Promise.all(index.leadKeys.map((key) => storage.read(key)));
  return leads.filter((lead): lead is Lead => lead !== undefined) as Lead[];
}
