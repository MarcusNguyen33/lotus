export const examples = [
{id:'sample-1',name:'Dầu dưỡng da hằng ngày',brand:'BEAUTY ESSENTIALS',category:'Làm đẹp',price:690000,image:'https://images.unsplash.com/photo-1608571423539-e951b9b3871e?auto=format&fit=crop&w=800&q=85',description:'Sản phẩm minh họa. Thương hiệu, dung tích và thành phần sẽ được cập nhật trước khi mở bán.',active:0},
{id:'sample-2',name:'Giày sneaker phong cách Mỹ',brand:'EVERYDAY STYLE',category:'Thời trang',price:2450000,image:'https://images.unsplash.com/photo-1687444334081-8ca04ed2a1a3?auto=format&fit=crop&w=800&q=85',description:'Sản phẩm minh họa. Mẫu, màu sắc và kích cỡ sẽ được xác nhận khi mở bán.',active:0},
{id:'sample-3',name:'Túi canvas cho mỗi ngày',brand:'LITTLE EVERYDAY FINDS',category:'Phụ kiện',price:550000,image:'https://images.unsplash.com/photo-1548863227-3af567fc3b27?auto=format&fit=crop&w=800&q=85',description:'Sản phẩm minh họa. Chất liệu và kích thước sẽ được cập nhật.',active:0},
{id:'sample-4',name:'Bình nước thép không gỉ',brand:'HOME & LIVING',category:'Đời sống',price:890000,image:'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=85',description:'Sản phẩm minh họa. Dung tích sẽ được xác nhận trước khi mở bán.',active:0}
];
export type Product=typeof examples[number];
export const money=(n:number)=>new Intl.NumberFormat('vi-VN',{style:'currency',currency:'USD'}).format(n);
