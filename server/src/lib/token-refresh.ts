/**
 * Instagram Token Auto-Refresh
 * Automatically refreshes long-lived Instagram access tokens before they expire.
 * Long-lived tokens last ~60 days and can be refreshed as long as they haven't expired.
 */

import { sendTelegramMessage } from './telegram.js';

/**
 * Refresh the Instagram long-lived access token.
 * Returns the new token if successful.
 */
export async function refreshInstagramToken(): Promise<string | null> {
    const currentToken = process.env.INSTAGRAM_ACCESS_TOKEN;

    if (!currentToken) {
        console.error('❌ No INSTAGRAM_ACCESS_TOKEN found');
        return null;
    }

    try {
        console.log('🔄 Refreshing Instagram access token...');

        const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FACEBOOK_APP_ID}&client_secret=${process.env.FACEBOOK_APP_SECRET}&fb_exchange_token=${currentToken}`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (data.error) {
            console.error('❌ Token refresh failed:', data.error.message);
            await sendTelegramMessage(`⚠️ <b>Instagram token refresh failed!</b>\n\n${data.error.message}\n\nGenerate a new token manually from Graph API Explorer.`);
            return null;
        }

        const newToken = data.access_token;
        const expiresIn = data.expires_in; // seconds
        const expiresDays = Math.round(expiresIn / 86400);

        // Update in-memory env var
        process.env.INSTAGRAM_ACCESS_TOKEN = newToken;

        console.log(`✅ Instagram token refreshed! Expires in ${expiresDays} days`);
        await sendTelegramMessage(`🔄 <b>Instagram token refreshed!</b>\n\n⏰ Berlaku ${expiresDays} hari ke depan.`);

        return newToken;

    } catch (error) {
        console.error('❌ Token refresh error:', error);
        await sendTelegramMessage(`⚠️ <b>Token refresh error:</b> ${(error as Error).message}`);
        return null;
    }
}

/**
 * Check if the current token is still valid
 */
export async function checkTokenHealth(): Promise<{ valid: boolean; expiresIn?: number }> {
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!token) return { valid: false };

    try {
        const response = await fetch(`https://graph.facebook.com/v21.0/debug_token?input_token=${token}&access_token=${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`);
        const data = await response.json() as any;

        if (data.data) {
            const expiresAt = data.data.expires_at;
            const now = Math.floor(Date.now() / 1000);
            const expiresIn = expiresAt - now;

            return {
                valid: data.data.is_valid,
                expiresIn, // seconds remaining
            };
        }

        return { valid: false };
    } catch {
        return { valid: false };
    }
}
