import OrdersClient from "@/components/admin/OrdersClient";
import {parseQueueFilter} from '@/lib/admin-insights';

export default async function OrdersPage({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}) {
  const {filter,error}=parseQueueFilter(await searchParams);
  return <OrdersClient key={JSON.stringify(filter)} initialInsight={filter} insightError={error}/>;
}
