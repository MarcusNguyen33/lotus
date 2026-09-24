import {hash,sameOrigin} from '@/lib/server';
import {filter,supabaseOne} from '@/lib/supabase';
import {paymentsReady,stripeClient,paymentMatches,reconcilePayment} from '@/lib/payments';

export async function POST(request:Request) {
  if(!sameOrigin(request))return Response.json({error:'Invalid origin'},{status:403});
  if(!paymentsReady())return Response.json({error:'Thanh toán thử nghiệm chưa sẵn sàng.'},{status:503});
  try {
    const raw=await request.text();if(raw.length>1000)return Response.json({error:'Invalid request'},{status:400});
    const {code,token}=JSON.parse(raw);
    if(typeof code!=='string'||!/^LOT-[A-F0-9]{16}$/.test(code)||typeof token!=='string'||!/^[a-f0-9-]{36}$/.test(token))return Response.json({error:'Kiểm tra mã đơn và mã tra cứu.'},{status:400});
    let order=await supabaseOne('orders',{},filter({code:`eq.${code}`,token_hash:`eq.${await hash(token)}`,select:'id,code,status,payment_status,grand_total,stripe_checkout_session_id'}));
    if(!order)return Response.json({error:'Không tìm thấy đơn hàng.'},{status:404});
    if(order.payment_status==='paid')return Response.json({paid:true});
    if(order.status!=='Đã xác nhận')return Response.json({error:'LotUS cần xác nhận tổng phí trước khi thanh toán.'},{status:409});
    const amount=Math.round(Number(order.grand_total)*100);
    if(!Number.isSafeInteger(amount)||amount<50||amount>99999999)return Response.json({error:'Tổng phí không hợp lệ.'},{status:409});
    const stripe=stripeClient();
    if(order.stripe_checkout_session_id){
      const existing=await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
      if(!paymentMatches(order,existing))throw Error('Payment mismatch');
      if(existing.payment_status==='paid'){await reconcilePayment(existing);return Response.json({paid:true})}
      if(existing.status==='open'&&existing.url)return Response.json({url:existing.url});
      if(existing.status==='complete')return Response.json({error:'Stripe đang xử lý thanh toán. Vui lòng tra cứu lại sau.'},{status:409});
    }
    // Freeze the quote atomically before creating a session; repeated requests share an idempotency key.
    const frozen=await supabaseOne('orders',{method:'PATCH',body:JSON.stringify({payment_status:'pending'})},filter({id:`eq.${order.id}`,status:'eq.Đã xác nhận',payment_status:`eq.${order.payment_status}`,grand_total:`eq.${order.grand_total}`,stripe_checkout_session_id:order.stripe_checkout_session_id?`eq.${order.stripe_checkout_session_id}`:'is.null'}));
    if(!frozen)return Response.json({error:'Đơn vừa được cập nhật. Vui lòng thử lại.'},{status:409});
    const origin=new URL(request.url).origin;
    const session=await stripe.checkout.sessions.create({
      mode:'payment',client_reference_id:order.code,metadata:{order_id:String(order.id)},
      integration_identifier:'lotus_checkout_hqvntzrp',
      line_items:[{quantity:1,price_data:{currency:'usd',unit_amount:amount,product_data:{name:`LotUS ${order.code}`,description:'Tổng phí đã xác nhận, gồm sản phẩm và phí vận chuyển / phí khác.'}}}],
      success_url:origin+'/?payment=return',cancel_url:origin+'/?payment=cancelled',
    },{idempotencyKey:`lotus-${order.id}-${order.stripe_checkout_session_id||'initial'}`});
    if(!paymentMatches(order,session)||!session.url)throw Error('Invalid session');
    const saved=await supabaseOne('orders',{method:'PATCH',body:JSON.stringify({stripe_checkout_session_id:session.id})},filter({id:`eq.${order.id}`,payment_status:'eq.pending',stripe_checkout_session_id:order.stripe_checkout_session_id?`eq.${order.stripe_checkout_session_id}`:'is.null'}));
    if(!saved){const latest=await supabaseOne('orders',{},filter({id:`eq.${order.id}`,select:'stripe_checkout_session_id'}));if(latest?.stripe_checkout_session_id!==session.id)throw Error('Session conflict')}
    return Response.json({url:session.url},{headers:{'Cache-Control':'no-store'}});
  }catch{return Response.json({error:'Chưa thể mở Stripe. Vui lòng thử lại hoặc liên hệ LotUS.'},{status:503})}
}
