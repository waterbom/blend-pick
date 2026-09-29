import { withApiErrors } from '@/lib/api-errors';
import { NextRequest } from "next/server";
import { shopCheckout } from "@/lib/shop-checkout";
async function handlePOST(req: NextRequest) { return shopCheckout(req, "cart"); }

export const POST = withApiErrors('POST /api/payment/cart-confirm', handlePOST);
