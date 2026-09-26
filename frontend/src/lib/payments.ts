// Which payment methods buyers can pick, and the PromptPay details.
//
// PromptPay pays the team's account; the buyer uploads the slip and the
// verify-slip Edge Function checks it with SlipOK. On the live site PromptPay
// only appears once both are configured:
//   PUBLIC_PROMPTPAY_API_URL  verify-slip function URL (…/functions/v1/verify-slip)
//   PUBLIC_PROMPTPAY_ID       the team's PromptPay number (same account as the SlipOK branch)
// Demo mode always shows the mock screen so the flow can be demonstrated.
import { env } from '$env/dynamic/public';
import generatePayload from 'promptpay-qr';
import type { Order } from '$lib/types';
import { isLive } from './supabase';

export const verifySlipUrl = env.PUBLIC_PROMPTPAY_API_URL?.trim() ?? '';
export const promptPayId = env.PUBLIC_PROMPTPAY_ID?.trim() ?? '';
/** Account name shown under the QR so buyers know who they are paying (optional) */
export const promptPayName = env.PUBLIC_PROMPTPAY_NAME?.trim() ?? '';

export function promptPayAvailable(live: boolean, apiUrl: string | undefined, id: string | undefined): boolean {
	return !live || (!!apiUrl?.trim() && !!id?.trim());
}

export const promptPayEnabled = promptPayAvailable(isLive, verifySlipUrl, promptPayId);

/** EMVCo PromptPay QR text for one payment of `amount` baht to the team */
export function promptPayPayload(amount: number, id = promptPayId): string {
	return generatePayload(id, { amount });
}

/** A PromptPay order that has no verified slip yet: riders do not see it */
export function awaitingPayment(order: Pick<Order, 'paymentMethod' | 'paidAt' | 'status'>): boolean {
	return order.paymentMethod === 'PROMPTPAY' && !order.paidAt && order.status === 'PENDING';
}
