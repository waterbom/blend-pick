import { NextRequest } from "next/server";
import { shopCheckout } from "@/lib/shop-checkout";
export async function POST(req: NextRequest) { return shopCheckout(req, "shop"); }
