import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function database(){const db=(env as any).DB;if(!db)throw Error('Database unavailable');return db as D1Database}
export async function owner(){const user=await getChatGPTUser();const email=(env as any).OWNER_EMAIL;return !!(user&&email&&user.email.toLowerCase()===email.toLowerCase())}
export async function hash(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(n=>n.toString(16).padStart(2,'0')).join('')}
export const statuses=['Chờ xác nhận','Đã xác nhận','Đã mua tại Mỹ','Đang vận chuyển về Việt Nam','Đang giao hàng','Đã giao hàng','Đã hủy'];
export function sameOrigin(r:Request){return r.headers.get('origin')===new URL(r.url).origin}
