import {owner,sameOrigin,statuses} from '@/lib/server';
import {supabaseOne,supabaseQuery,filter,productView,orderView} from '@/lib/supabase';
export async function GET() {
  if(!await owner()) return Response.json({error:'Owner access required'},{status:403});
  try {
    const [products,orders]=await Promise.all([
      supabaseQuery('products',{},filter({select:'*',order:'id.desc'})),
      supabaseQuery('orders',{},filter({select:'id,code,customer_name,phone,email,shipping_address,note,items,subtotal,shipping_cost,grand_total,status,shipment,payment_status,created_at',order:'created_at.desc',limit:'250'})),
    ]);
    return Response.json({products:products.map(productView),orders:orders.map(orderView)},{headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({error:'Không thể tải dữ liệu.'},{status:503})}
}
export async function POST(r:Request) {
  if(!sameOrigin(r)||!await owner()) return Response.json({error:'Owner access required'},{status:403});
  try {
    const raw=await r.text();if(raw.length>15000)return Response.json({error:'Yêu cầu quá lớn'},{status:413});
    const d=JSON.parse(raw);
    if(d.kind==='order') {
      if(!/^\d{1,16}$/.test(String(d.id))||!statuses.includes(d.status)||typeof d.shipment!=='string'||d.shipment.length>1000||!Number.isFinite(d.shipping_cost)||d.shipping_cost<0||d.shipping_cost>10000) return Response.json({error:'Dữ liệu không hợp lệ.'},{status:400});
      const current=await supabaseOne('orders',{},filter({id:`eq.${d.id}`,select:'subtotal,payment_status,shipping_cost'}));
      if(!current)return Response.json({error:'Không tìm thấy đơn.'},{status:404});
      if(current.payment_status!=='unpaid'&&(Number(current.shipping_cost)!==d.shipping_cost||d.status==='Đã hủy'||d.status==='Chờ xác nhận'))return Response.json({error:'Thanh toán đã bắt đầu. Không thể đổi phí hoặc hủy đơn này tại đây.'},{status:409});
      const shipping=Math.round(d.shipping_cost*100)/100;
      const saved=await supabaseOne('orders',{method:'PATCH',body:JSON.stringify({status:d.status,shipment:d.shipment,shipping_cost:shipping,grand_total:Math.round((Number(current.subtotal)+shipping)*100)/100})},filter({id:`eq.${d.id}`,payment_status:`eq.${current.payment_status}`}));
      if(!saved)return Response.json({error:'Đơn vừa thay đổi. Vui lòng tải lại.'},{status:409});
    } else {
      if(typeof d.name!=='string'||!d.name.trim()||d.name.length>150||typeof d.brand!=='string'||d.brand.length>100||typeof d.category!=='string'||!d.category.trim()||d.category.length>100||!Number.isFinite(d.price)||d.price<0.5||d.price>100000||!Number.isFinite(d.weight_lb)||d.weight_lb<0||d.weight_lb>1000||typeof d.description!=='string'||d.description.length>5000||typeof d.image!=='string'||d.image.length>2000||!/^https:\/\//.test(d.image)||![0,1].includes(d.active))return Response.json({error:'Kiểm tra thông tin, giá USD và URL ảnh HTTPS.'},{status:400});
      const row={name:d.name.trim(),brand:d.brand,category:d.category,price:Math.round(d.price*100)/100,weight_lb:d.weight_lb,image_url:d.image,description:d.description,active:Boolean(d.active)};
      if(d.id){if(!/^\d{1,16}$/.test(String(d.id)))return Response.json({error:'Invalid id'},{status:400});await supabaseOne('products',{method:'PATCH',body:JSON.stringify(row)},filter({id:`eq.${d.id}`}));}
      else await supabaseOne('products',{method:'POST',body:JSON.stringify(row)});
    }
    return Response.json({ok:true});
  } catch {return Response.json({error:'Không thể lưu. Vui lòng thử lại.'},{status:503})}
}
