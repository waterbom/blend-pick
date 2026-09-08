import type {PoolClient} from "pg";
export function recordDeliverySettlement(client:Pick<PoolClient,"query">,order:{id:string;order_number:string;total_amount:number|string;payment_method:string|null;payment_key:string|null}):Promise<void>;
