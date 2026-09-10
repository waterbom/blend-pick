import shopPool from "@/lib/db-shop";
import {SITES,type SiteKey} from "@/lib/sites";
export async function ownedInfluencerProducts(influencerId:string,site:SiteKey,productId?:string){
 const {rows}=await shopPool.query(`SELECT p.*,
   NOT EXISTS(SELECT 1 FROM product_options po WHERE po.product_id=p.id)
    OR EXISTS(SELECT 1 FROM product_options po WHERE po.product_id=p.id AND po.is_active=true AND po.stock<>0) AS options_available
   FROM products_shop p WHERE p.influencer_rate IS NOT NULL AND p.is_visible=true
    AND p.influencer_id::text=$1
    AND (($2='sanjipick' AND p.category=ANY($3::text[])) OR ($2='blendpick' AND NOT(COALESCE(p.category,'')=ANY($3::text[]))))
   AND ($4::uuid IS NULL OR p.id=$4)
   ORDER BY p.created_at DESC`,[influencerId,site,SITES.sanjipick.categories,productId??null]);
 return rows;
}
