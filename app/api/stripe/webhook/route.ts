import Stripe from 'stripe';
import {env} from 'cloudflare:workers';
import {stripeClient,reconcilePayment} from '@/lib/payments';
export async function POST(request:Request){
  const signature=request.headers.get('stripe-signature'),secret=(env as any).STRIPE_WEBHOOK_SECRET;
  if(!signature||!secret)return new Response('Signature required',{status:400});
  let event:Stripe.Event;
  try{event=await stripeClient().webhooks.constructEventAsync(await request.text(),signature,secret,undefined,Stripe.createSubtleCryptoProvider())}catch{return new Response('Invalid signature',{status:400})}
  if(event.livemode)return new Response('Test mode required',{status:400});
  try{
    if(event.type==='checkout.session.completed'||event.type==='checkout.session.async_payment_succeeded')await reconcilePayment(event.data.object as Stripe.Checkout.Session);
    return Response.json({received:true});
  }catch{return new Response('Please retry',{status:500})}
}
