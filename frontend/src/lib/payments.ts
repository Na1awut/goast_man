// Which payment methods buyers can pick.
//
// The PromptPay screen is still a mock QR: no money moves. Real buyers must not
// see it, or they could "pay" and believe it went through. So in live mode
// PromptPay stays hidden until a payment API is configured: set
// PUBLIC_PROMPTPAY_API_URL (the payment integration's endpoint) and it turns on
// by itself. Demo mode always shows it so the flow can be demonstrated.
import { env } from '$env/dynamic/public';
import { isLive } from './supabase';

export function promptPayAvailable(live: boolean, apiUrl: string | undefined): boolean {
	return !live || !!apiUrl?.trim();
}

export const promptPayEnabled = promptPayAvailable(isLive, env.PUBLIC_PROMPTPAY_API_URL);
