import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'LotUS — Từ Mỹ, gửi về nhà',description:'Khám phá và đặt hàng từ Mỹ, giao đến Việt Nam cùng LotUS.',icons:{icon:'/favicon.svg'}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="vi"><body>{children}</body></html>}
