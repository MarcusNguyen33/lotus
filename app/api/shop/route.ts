import {hash,sameOrigin} from '@/lib/server';
import {supabaseOne,supabaseQuery,filter,productView} from '@/lib/supabase';

export async function GET(r:Request) {
  try {
    const url=new URL(r.url),code=url.searchParams.get('code');
    if(code) {
      const token=url.searchParams.get('token') || '';
      if(!/^LOT-[A-F0-9]{16}$/.test(code) || token.length!==36) return Response.json({error:'Kiểm tra mã đơn và mã tra cứu.'},{status:404});
      const row=await supabaseOne('orders',{},filter({code:`eq.${code}`,token_hash:`eq.${await hash(token)}`,select:'code,subtotal,shipping_cost,grand_total,status,shipment,payment_status'}));
      return row ? Response.json({...row,total:row.grand_total},{headers:{'Cache-Control':'no-store'}}) : Response.json({error:'Không tìm thấy đơn hàng. Kiểm tra mã đơn và mã tra cứu.'},{status:404});
    }
    const rows=await supabaseQuery('products',{},filter({select:'id,name,brand,category,price,image_url,description,weight_lb,active',active:'eq.true',order:'id.desc'}));
    return Response.json({products:rows.map(productView)},{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Cửa hàng tạm thời không khả dụng. Vui lòng thử lại.'},{status:503})}
}

export async function POST(r:Request) {
  if(!sameOrigin(r)) return Response.json({error:'Invalid origin'},{status:403});
  try {
    const raw=await r.text();
    if(raw.length>15000) return Response.json({error:'Yêu cầu quá lớn'},{status:413});
    const d=JSON.parse(raw);
    if(typeof d.name!=='string'||!d.name.trim()||d.name.length>100||typeof d.phone!=='string'||!/^\+?[0-9 ()-]{9,20}$/.test(d.phone)||typeof d.email!=='string'||!/^\S+@\S+\.\S+$/.test(d.email)||d.email.length>200||typeof d.address!=='string'||d.address.trim().length<10||d.address.length>500||typeof d.note!=='string'||d.note.length>1000||!Array.isArray(d.items)||!d.items.length||d.items.length>30||typeof d.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(d.requestId)||typeof d.token!=='string'||!/^[a-f0-9-]{36}$/.test(d.token)) return Response.json({error:'Vui lòng kiểm tra thông tin nhận hàng.'},{status:400});
    const tokenHash=await hash(d.token);
    const existing=await supabaseOne('orders',{},filter({request_id:`eq.${d.requestId}`,select:'code,token_hash,subtotal'}));
    if(existing) return existing.token_hash===tokenHash ? Response.json({code:existing.code,token:d.token,total:existing.subtotal}) : Response.json({error:'Yêu cầu không hợp lệ.'},{status:409});
    const ids=new Set<string>(),items=[];let cents=0;
    for(const line of d.items) {
      if(typeof line.id!=='string'||!/^\d{1,16}$/.test(line.id)||ids.has(line.id)||!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>20) return Response.json({error:'Sản phẩm hoặc số lượng không hợp lệ.'},{status:400});
      ids.add(line.id);
      const p=await supabaseOne('products',{},filter({id:`eq.${line.id}`,active:'eq.true',select:'id,name,price,weight_lb'}));
      if(!p||!Number.isFinite(Number(p.price))||Number(p.price)<=0) return Response.json({error:'Sản phẩm không còn mở bán. Hãy tải lại giỏ hàng.'},{status:409});
      const unitCents=Math.round(Number(p.price)*100);
      cents+=unitCents*line.quantity;
      items.push({id:String(p.id),name:p.name,price:unitCents/100,quantity:line.quantity,weight_lb:p.weight_lb});
    }
    const code='LOT-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase();
    const row={code,token_hash:tokenHash,request_id:d.requestId,customer_name:d.name.trim(),phone:d.phone,email:d.email,shipping_address:d.address.trim(),note:d.note,items,subtotal:cents/100,shipping_cost:0,grand_total:cents/100,status:'Chờ xác nhận',shipment:'',payment_status:'unpaid'};
    await supabaseOne('orders',{method:'POST',body:JSON.stringify(row)});
    return Response.json({code,token:d.token,total:cents/100},{status:201,headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Không thể gửi yêu cầu. Vui lòng thử lại.'},{status:503})}
}
