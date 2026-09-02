import { Request, Response } from 'express';

// Cookie configuration
const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';
const ACCESS_TOKEN_COOKIE_NAME = 'accessToken';
const isProduction = process.env.NODE_ENV === 'production';

// Determine if we're in a cross-domain scenario
// When frontend and backend are on different domains, we need sameSite: 'none'
const isCrossDomain = process.env.ALLOW_CROSS_DOMAIN_COOKIES === 'true' || 
                      (process.env.FRONTEND_URL && 
                       process.env.FRONTEND_URL !== process.env.BACKEND_URL);

// For cross-domain cookies, sameSite must be 'none' and secure must be true
// For same-domain cookies, we can use 'strict' for better security
const cookieSameSite = 'lax';
const domain = isProduction ? '.cofiblocks.com' : undefined;

const isLocalhostFrontend = process.env.FRONTEND_URL && (
  process.env.FRONTEND_URL?.includes('localhost') ||
  process.env.FRONTEND_URL?.includes('127.0.0.1'));

// When sameSite is 'none', secure MUST be true (browser requirement)
const cookieSecure = isLocalhostFrontend ? false : isCrossDomain ? true : isProduction;

/**
 * Get client IP address from request
 */
export function getClientIp(req: Request): string {
    return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        (req.headers['x-real-ip'] as string) ||
        req.socket.remoteAddress ||
        'unknown'
    );
}

/**
 * Set refresh token as HttpOnly cookie
 * Supports both same-domain and cross-domain scenarios
 */
export function setRefreshTokenCookie(res: Response, refreshToken: string): void {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

    res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, {
        httpOnly: true, // Prevents JavaScript access (XSS protection)
        secure: cookieSecure, // Required for sameSite: 'none', or HTTPS in production
        sameSite: cookieSameSite, // 'none' for cross-domain, 'strict' for same-domain
        domain: domain,
        maxAge, // 7 days
        path: '/', // Available for all paths
    });
}

/**
 * Clear refresh token cookie
 */
export function clearRefreshTokenCookie(res: Response): void {
    res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        domain: domain,
        path: '/',
});
}

/**
 * Get refresh token from cookie or request body (for backward compatibility)
 */
export function getRefreshToken(req: Request): string | null {
    return req.cookies[REFRESH_TOKEN_COOKIE_NAME] || req.body.refreshToken || null;
}

/**
 * Parse JWT expiry string (e.g., '10m', '1h', '7d') to milliseconds
 */
function parseExpiryToMs(expiry: string): number {
    const unit = expiry.slice(-1);
    const value = parseInt(expiry.slice(0, -1)) || 10;
    
    switch (unit) {
        case 'm': // minutes
            return value * 60 * 1000;
        case 'h': // hours
            return value * 60 * 60 * 1000;
        case 'd': // days
            return value * 24 * 60 * 60 * 1000;
        default:
            // Default to 10 minutes if format is unknown
            return 10 * 60 * 1000;
    }
}

/**
 * Set access token as HttpOnly cookie
 * Supports both same-domain and cross-domain scenarios
 */
export function setAccessTokenCookie(res: Response, accessToken: string): void {
    const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '10m';
    const maxAge = parseExpiryToMs(accessTokenExpiry);

    res.cookie(ACCESS_TOKEN_COOKIE_NAME, accessToken, {
        httpOnly: true, // Prevents JavaScript access (XSS protection)
        secure: cookieSecure, // Required for sameSite: 'none', or HTTPS in production
        sameSite: cookieSameSite, // 'none' for cross-domain, 'strict' for same-domain
        domain: domain,
        maxAge, // Based on JWT_ACCESS_EXPIRY env var
        path: '/', // Available for all paths
    });
}

/**
 * Clear access token cookie
 */
export function clearAccessTokenCookie(res: Response): void {
    res.clearCookie(ACCESS_TOKEN_COOKIE_NAME, {
        httpOnly: true,
        secure: cookieSecure,
        sameSite: cookieSameSite,
        domain: domain,
        path: '/',
    });
}

/**
 * Get access token from cookie or Authorization header (for backward compatibility)
 */
export function getAccessToken(req: Request): string | null {
    // First check cookie, then check Authorization header
    if (req.cookies[ACCESS_TOKEN_COOKIE_NAME]) {
        return req.cookies[ACCESS_TOKEN_COOKIE_NAME];
    }
    
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    return null;
}
