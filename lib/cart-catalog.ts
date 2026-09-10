import shopPool from '@/lib/db-shop';
import {quoteCartAmount} from '@/lib/order-amount';
import {secretUnitPrice} from '@/lib/secret-link';
import type {SiteKey} from '@/lib/sites';
export class CartSelectionError extends Error {}
export async function resolveCartItem(item:any,site:SiteKey,db:Pick<typeof shopPool,'query'>=shopPool){
  if(!item||!Number.isSafeInteger(item.quantity)||item.quantity<1||item.quantity>999)throw new CartSelectionError('수량은 1~999개로 입력해주세요.');
  const result=await quoteCartAmount({site,items:[item],totalAmount:0,shippingCost:0,amount:0},db);
  if(!result.ok)throw new CartSelectionError(result.error);
  const pr=await db.query(`SELECT id AS product_id,name,brand,price,main_image,status,stock,shipping_type,shipping_cost,free_shipping_threshold,per_unit_shipping_cost,
    to_jsonb(products_shop)->>'expected_ship_date' AS expected_ship_date,
    to_jsonb(products_shop)->>'supplier_name' AS supplier_name,to_jsonb(products_shop)->>'release_address' AS release_address,to_jsonb(products_shop)->>'shipping_carrier' AS shipping_carrier
    FROM products_shop WHERE id=$1`,[item.product_id]);
  const opts=await db.query('SELECT id,name,value,extra_price,link_price,stock,is_active FROM product_options WHERE product_id=$1 AND removed_at IS NULL',[item.product_id]);
  const product=pr.rows[0];
  const options=opts.rows.filter(o=>o.is_active&&o.stock!==0).flatMap(o=>{const price=secretUnitPrice(product,o,!!result.linkCode);return price===null?[]:[{id:o.id,name:o.name,value:o.value,price,stock:o.stock}];});
  const selected=options.find(o=>o.id===item.option_id);
  return {...product,id:item.id,quantity:item.quantity,option_id:item.option_id||null,option_name:selected?.name||null,option_value:selected?.value||null,
    price:result.units[0],extra_price:item.option_id?result.units[0]:null,link_code:item.link_code||null,availableOptions:options};
}
