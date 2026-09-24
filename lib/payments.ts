import Stripe from 'stripe';
import {env} from 'cloudflare:workers';
import {filter,supabaseOne} from './supabase';

export function stripeClient() {
  const key=(env as any).STRIPE_RESTRICTED_KEY;
  if(typeof key!=='string'||!key.startsWith('rk_test_')) throw Error('Test payments unavailable');
  return new Stripe(key,{apiVersion:'2026-07-29.dahlia',httpClient:Stripe.createFetchHttpClient(),maxNetworkRetries:2});
}
export function paymentsReady(){return Boolean((env as any).STRIPE_RESTRICTED_KEY&&(env as any).STRIPE_WEBHOOK_SECRET)}
export function paymentMatches(order:any,session:Stripe.Checkout.Session) {
  return !session.livemode&&session.mode==='payment'&&session.currency==='usd'&&session.metadata?.order_id===String(order.id)&&session.client_reference_id===order.code&&session.amount_total===Math.round(Number(order.grand_total)*100);
}
export async function reconcilePayment(session:Stripe.Checkout.Session) {
  if(session.livemode||!session.metadata?.order_id)return;
  const order=await supabaseOne('orders',{},filter({id:`eq.${session.metadata.order_id}`,stripe_checkout_session_id:`eq.${session.id}`,select:'id,code,grand_total,payment_status'}));
  if(!order||!paymentMatches(order,session))return;
  // A completed redirect is not proof of payment; only Stripe's paid state is.
  if(session.payment_status==='paid'&&order.payment_status!=='paid')await supabaseOne('orders',{method:'PATCH',body:JSON.stringify({payment_status:'paid'})},filter({id:`eq.${order.id}`,stripe_checkout_session_id:`eq.${session.id}`}));
}
