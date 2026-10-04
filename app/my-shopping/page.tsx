import Header from '@/components/Header';
import CustomerShopping from '@/components/CustomerShopping';
export const metadata={title:'관심 상품·알림',robots:{index:false,follow:false}};
export default function ShoppingPage(){return <main><Header/><div className="care-page"><CustomerShopping/></div></main>;}
