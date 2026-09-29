import { withApiErrors } from '@/lib/api-errors';
import { campaignCheckout } from '@/lib/campaign-checkout';
export const POST = withApiErrors('POST /api/payment/confirm', campaignCheckout);
