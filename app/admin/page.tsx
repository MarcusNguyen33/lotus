import {requireChatGPTUser} from '@/app/chatgpt-auth';
import {owner} from '@/lib/server';
import Admin from './panel';
export const dynamic='force-dynamic';
export default async function Page(){await requireChatGPTUser('/admin');if(!await owner())return <main className="admin"><a href="/">← LotUS</a><h1>Quản lý cửa hàng</h1><p>Tài khoản này chưa được cấp quyền quản lý. Chủ cửa hàng cần cấu hình email quản trị trước khi đăng sản phẩm và xem đơn hàng.</p></main>;return <Admin/>}
