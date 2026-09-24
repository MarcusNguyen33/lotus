import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {webcrypto,createHash} from 'node:crypto';
import Stripe from 'stripe';

// Exercise the actual routes with isolated database and Stripe services.
const context=vm.createContext({Request,Response,URL,URLSearchParams,crypto:webcrypto,console});
const token='12345678-1234-1234-1234-123456789abc';
let order,created=0,session;
function reset(){created=0;session=null;order={id:1,code:'LOT-1234567890ABCDEF',token_hash:createHash('sha256').update(token).digest('hex'),status:'Đã xác nhận',payment_status:'unpaid',grand_total:35.99,stripe_checkout_session_id:null}}
const hash=async value=>createHash('sha256').update(value).digest('hex');
const db={filter:v=>'?'+new URLSearchParams(v),supabaseOne:async(_table,init={},query='')=>{
  const p=new URLSearchParams(query);
  for(const [key,value] of p){if(key==='select')continue;if(value==='is.null'&&order[key]!=null)return null;if(value.startsWith('eq.')&&String(order[key])!==value.slice(3))return null;}
  if(init.method==='PATCH')Object.assign(order,JSON.parse(init.body));
  return {...order};
}};
class FakeStripe {
  static createFetchHttpClient(){}
  static createSubtleCryptoProvider(){return Stripe.createSubtleCryptoProvider()}
  webhooks=new Stripe('rk_test_placeholder').webhooks;
  checkout={sessions:{retrieve:async()=>session,create:async(params)=>{
    assert.equal(params.line_items[0].price_data.unit_amount,3599);
    assert.equal(params.payment_method_types,undefined);
    assert.equal(params.mode,'payment');
    created++;
    session={id:'cs_test_sample',url:'https://checkout.stripe.com/test/sample',livemode:false,mode:'payment',currency:'usd',amount_total:3599,status:'open',payment_status:'unpaid',metadata:params.metadata,client_reference_id:params.client_reference_id};return session;
  }}};
}
const env={STRIPE_RESTRICTED_KEY:'rk_test_placeholder',STRIPE_WEBHOOK_SECRET:'whsec_verification_fixture'};
const modules=new Map();
function synthetic(name,values){const mod=new vm.SyntheticModule(Object.keys(values),function(){for(const [k,v]of Object.entries(values))this.setExport(k,v)},{context,identifier:name});modules.set(name,mod);return mod}
synthetic('stripe',{default:FakeStripe});synthetic('cloudflare:workers',{env});synthetic('@/lib/supabase',db);synthetic('@/lib/server',{hash,sameOrigin:r=>r.headers.get('origin')===new URL(r.url).origin});
function source(name,path){const js=ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;const mod=new vm.SourceTextModule(js,{context,identifier:name});modules.set(name,mod);return mod}
const payments=source('@/lib/payments','lib/payments.ts');
const checkout=source('checkout','app/api/checkout/route.ts');
const webhook=source('webhook','app/api/stripe/webhook/route.ts');
const link=specifier=>modules.get(specifier==='./supabase'?'@/lib/supabase':specifier);
await payments.link(link);await payments.evaluate();await checkout.link(link);await checkout.evaluate();await webhook.link(link);await webhook.evaluate();
const request=(body,origin='https://lotus.example')=>new Request('https://lotus.example/api/checkout',{method:'POST',headers:{origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
reset();const body={code:order.code,token,amount:1};
assert.equal((await checkout.namespace.POST(request(body,'https://evil.example'))).status,403);
assert.equal((await checkout.namespace.POST(request({...body,token:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}))).status,404);
order.status='Chờ xác nhận';assert.equal((await checkout.namespace.POST(request(body))).status,409);assert.equal(created,0);
order.status='Đã xác nhận';assert.equal((await checkout.namespace.POST(request(body))).status,200);assert.equal(order.payment_status,'pending');assert.equal(created,1);
assert.equal((await checkout.namespace.POST(request(body))).status,200);assert.equal(created,1);
await payments.namespace.reconcilePayment({...session,payment_status:'paid',amount_total:1});assert.equal(order.payment_status,'pending');
await payments.namespace.reconcilePayment({...session,payment_status:'paid',livemode:true});assert.equal(order.payment_status,'pending');
assert.equal((await webhook.namespace.POST(new Request('https://lotus.example/api/stripe/webhook',{method:'POST',body:'{}'}))).status,400);
const payload=JSON.stringify({id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{...session,payment_status:'paid',status:'complete'}}});
const signature=new Stripe('rk_test_placeholder').webhooks.generateTestHeaderString({payload,secret:env.STRIPE_WEBHOOK_SECRET});
const send=()=>webhook.namespace.POST(new Request('https://lotus.example/api/stripe/webhook',{method:'POST',headers:{'stripe-signature':signature},body:payload}));
assert.equal((await send()).status,200);assert.equal(order.payment_status,'paid');assert.equal((await send()).status,200);
assert.equal((await checkout.namespace.POST(request(body))).status,200);assert.equal(created,1);
console.log('PASS: origin/token authorization, quote confirmation, authoritative price, session reuse, amount/mode verification, signed webhook, replay safety, and paid-order protection.');
