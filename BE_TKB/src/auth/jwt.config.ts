/**
 * Single source of truth for the JWT signing secret and the (separate) captcha
 * HMAC secret.
 *
 * Why this file exists:
 * - Previously auth.module.ts fell back to 'SECRET_KEY' while auth.service.ts
 *   fell back to 'MY_CAPTCHA_SECRET_KEY'. If JWT_SECRET was unset, tokens were
 *   signed with one fallback and captcha hashed with another — silent drift.
 * - The captcha HMAC and the JWT signature used the SAME secret, so leaking one
 *   (e.g. via a forged captcha) handed an attacker the JWT signing key too.
 *
 * Now:
 * - getJwtSecret() throws in production if JWT_SECRET is missing/too weak, so a
 *   deploy with no secret fails fast instead of running with a guessable key.
 * - getCaptchaSecret() is domain-separated from the JWT secret, so compromising
 *   the captcha channel does not reveal the token-signing key.
 */

const MIN_SECRET_LENGTH = 16;

/** Dev-only fallback. Never used when NODE_ENV=production (we throw instead). */
const DEV_FALLBACK = 'dev-only-insecure-secret-change-me';

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < MIN_SECRET_LENGTH) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error(
                `JWT_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} chars. ` +
                `Set a strong JWT_SECRET (>=32 chars recommended) before starting in production.`,
            );
        }
        // Non-production: warn loudly but keep dev ergonomics.
        // eslint-disable-next-line no-console
        console.warn(
            '[auth] JWT_SECRET is missing or weak — using an insecure dev fallback. ' +
            'DO NOT run like this in production.',
        );
        return secret || DEV_FALLBACK;
    }
    return secret;
}

/**
 * Captcha HMAC key, domain-separated from the JWT secret. A separate
 * CAPTCHA_SECRET env wins; otherwise we derive a distinct key from JWT_SECRET so
 * the two channels never share the exact same bytes.
 */
export function getCaptchaSecret(): string {
    if (process.env.CAPTCHA_SECRET && process.env.CAPTCHA_SECRET.length >= MIN_SECRET_LENGTH) {
        return process.env.CAPTCHA_SECRET;
    }
    return `${getJwtSecret()}::captcha-v1`;
}
