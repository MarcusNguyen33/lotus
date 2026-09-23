import {env} from 'cloudflare:workers';
type Row = Record<string, any>;

function config() {
  const url = (env as any).SUPABASE_URL;
  const key = (env as any).SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return { url: String(url).replace(/\/$/, ''), key: String(key) };
}

export function supabaseConfigured() { return Boolean(config()); }

export async function supabaseQuery<T extends Row = Row>(table: string, init: RequestInit = {}, query = ''): Promise<T[]> {
  const c = config();
  if (!c) throw new Error('Supabase is not configured');
  const response = await fetch(`${c.url}/rest/v1/${table}${query}`, {
    ...init,
    headers: {
      apikey: c.key,
      ...(c.key.startsWith('eyJ') ? {Authorization: `Bearer ${c.key}`} : {}),
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const body: any = await response.json().catch(() => ({}));
    console.error('Supabase request failed', {status: response.status, code: body.code});
    throw new Error('Database request failed');
  }
  if (response.status === 204) return [];
  return (await response.json()) as T[];
}

export function filter(values: Record<string,string>) {
  return '?' + new URLSearchParams(values).toString();
}

export function productView(p:Row) {
  return {id:String(p.id),name:p.name,brand:p.brand,category:p.category || 'Khác',price:Number(p.price),image:p.image_url || '',description:p.description || '',weight_lb:Number(p.weight_lb || 0),active:p.active === false ? 0 : 1};
}

export function orderView(o:Row) {
  return {...o,id:String(o.id),code:o.code || `OLD-${o.id}`,name:o.customer_name,address:o.shipping_address,total:o.grand_total,items:JSON.stringify(o.items),created:o.created_at};
}

export async function supabaseOne<T extends Row = Row>(table: string, init: RequestInit = {}, query = '') {
  const rows = await supabaseQuery<T>(table, { ...init, headers: { Prefer: 'return=representation', ...(init.headers ?? {}) } }, query);
  return rows[0] ?? null;
}
