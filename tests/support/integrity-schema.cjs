const fs=require('node:fs');
module.exports=async function(db,id){

 await db.exec(`CREATE TABLE products_shop(id uuid PRIMARY KEY,name text,category text,price int,stock int,status text,is_visible boolean,shipping_type text,shipping_cost int,free_shipping_threshold int,per_unit_shipping_cost int,link_price int,link_code text,updated_at timestamptz,sale_start_at timestamptz,sale_end_at timestamptz);
 CREATE TABLE product_options(id uuid PRIMARY KEY,product_id uuid REFERENCES products_shop(id) ON DELETE CASCADE,value text,extra_price int,stock int,is_active boolean);
 CREATE TABLE product_addons(product_id uuid,name text,extra_price int,is_active boolean);
 CREATE TABLE orders(id uuid PRIMARY KEY,site text,order_type text,paid_at timestamptz,status text,total_amount int,payment_key text,link_code text);
 CREATE TABLE order_items(id uuid PRIMARY KEY,order_id uuid,product_id uuid,quantity int);
 `);
 await db.exec(fs.readFileSync('scripts/secret-link-periods.sql','utf8'));
 for (const [table,cols] of Object.entries({
   products_shop:{product_code:'text',brand:'text',description:'text',original_price:'int',instant_discount_price:'int',sale_type:'text',presale_enabled:'boolean',presale_start_at:'timestamptz',presale_end_at:'timestamptz',tax_type:'text',shipping_carrier:'text',shipping_attr:'text',island_shipping_cost:'int',installation_cost:'int',release_address:'text',return_address:'text',return_cost_oneway:'int',return_cost_roundtrip:'int',exchange_cost_oneway:'int',exchange_cost_roundtrip:'int',as_notes:'text',manufacturer:'text',origin_country:'text',product_condition:'text',manufacture_date:'date',main_image:'text',addon_multi:'boolean',supply_price:'int',influencer_rate:'numeric',influencer_id:'uuid'},
   product_options:{name:'text',sort_order:'int',supply_price:'int'},
   product_addons:{id:'uuid default gen_random_uuid()',sort_order:'int'},
   orders:{order_number:'text',user_id:'uuid',buyer_name:'text',buyer_phone:'text',buyer_email:'text',recipient_name:'text',recipient_phone:'text',addr_zipcode:'text',addr_address:'text',addr_detail:'text',addr_memo:'text',shipping_fee:'int',payment_method:'text',influencer_id:'uuid',influencer_name:'text',commission_rate:'numeric',cancelled_at:'timestamptz',updated_at:'timestamptz'},
   order_items:{option_id:'uuid',product_name:'text',option_label:'text',unit_price:'int',supply_price:'int'},
 }))for(const [col,type] of Object.entries(cols)) await db.exec(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS ${col} ${type}`);
 for(const table of ['products_shop','product_options','orders','order_items']) await db.exec(`ALTER TABLE ${table} ALTER COLUMN id SET DEFAULT gen_random_uuid()`);
 await db.exec('CREATE TABLE product_images(product_id uuid,url text,sort_order int);'); await db.exec(`ALTER TABLE orders ADD COLUMN campaign_id uuid; ALTER TABLE orders ADD COLUMN created_at timestamptz DEFAULT NOW(); ALTER TABLE orders ADD COLUMN shipped_at timestamptz; ALTER TABLE orders ADD COLUMN delivered_at timestamptz; ALTER TABLE orders ADD COLUMN tracking_company text; ALTER TABLE orders ADD COLUMN tracking_number text;
 CREATE TABLE settlements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),payment_key text,order_id uuid,gross_amount int,fee int,net_amount int,settled_at timestamptz,created_at timestamptz);
 CREATE TABLE campaign_costs(id uuid DEFAULT gen_random_uuid(),campaign_id uuid,site text,category text,amount int,memo text);
 CREATE TABLE influencer_payouts(id uuid DEFAULT gen_random_uuid(),campaign_id uuid,influencer_id uuid,business_type text,gross_sales int,commission_rate numeric,commission int,supply_value int,vat int,withholding int,payout_amount int,status text,site text,paid_at timestamptz,updated_at timestamptz,UNIQUE(site,campaign_id,influencer_id));
 CREATE TABLE campaigns(id uuid,commission_rate numeric,influencer_id uuid,product_id uuid,start_date date,end_date date);
 CREATE TABLE products(id uuid,name text);
 CREATE TABLE influencers(id uuid,name text,business_type text,bank_name text,bank_account text,bank_holder text,id_card_file text,biz_cert_file text,bankbook_file text);
 CREATE TABLE order_returns(id uuid PRIMARY KEY,order_id uuid,kind text,status text,prev_status text,reason text);
 CREATE TABLE order_return_events(return_id uuid,status text,note text,admin_name text);
 INSERT INTO influencers(id,name,business_type) VALUES('${id(999)}','테스트 인플루언서','general');
 `);

await db.exec(fs.readFileSync('scripts/admin-integrity.sql','utf8'));
 await db.exec(require('node:fs').readFileSync(require('node:path').join(__dirname,'../../ops/sql/commerce-automation.sql'),'utf8'));
};
