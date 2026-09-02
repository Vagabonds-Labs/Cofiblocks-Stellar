import { Request, Response, NextFunction } from 'express';
import { JwtService } from '../services/app/JwtService';
import { HttpException } from '../exceptions/HttpException';
import { prisma } from '../lib/prisma';
import { getAccessToken } from '../utils/authUtils';

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        walletAddress: string;
        is_producer: boolean;
        is_roaster: boolean;
        is_admin: boolean;
      };
    }
  }
}

const jwtService = new JwtService();

/**
 * Authentication middleware
 * Verifies JWT access token and attaches user info to request
 */
export const authenticate = async (req: Request, _: Response, next: NextFunction) => {
  try {
    // Get token from cookie or Authorization header (cookie takes precedence)
    const token = getAccessToken(req);

    if (!token) {
      throw new HttpException(401, 'Access token is missing', 'MISSING_TOKEN');
    }

    // Verify token
    const payload = jwtService.verifyAccessToken(token);
    if (!payload) {
      throw new HttpException(401, 'Invalid or expired token', 'INVALID_TOKEN');
    }

    // Attach user info to request
    req.user = {
      userId: payload.userId,
      walletAddress: payload.walletAddress,
      is_producer: payload.is_producer,
      is_roaster: payload.is_roaster,
      is_admin: payload.is_admin
    };
    next();
  } catch (error) {
    // If it's already an HttpException, pass it through
    if (error instanceof HttpException) {
      return next(error);
    }
    next(new HttpException(401, 'Authentication failed', 'AUTH_FAILED', undefined, error));
  }
};

/**
 * Optional authentication middleware
 * Attaches user info if token is present, but doesn't fail if missing
 */
export const optionalAuthenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = getAccessToken(req);

    if (token) {
      const payload = jwtService.verifyAccessToken(token);

      if (payload) {
        req.user = {
          userId: payload.userId,
          walletAddress: payload.walletAddress,
          is_producer: payload.is_producer,
          is_roaster: payload.is_roaster,
          is_admin: payload.is_admin,
        };
      }
    }

    next();
  } catch (error) {
    // Silently continue if optional auth fails
    next();
  }
};

/**
 * Admin authorization middleware
 * Checks if the authenticated user is an admin
 * Must be used after authenticate middleware
 */
export const requireAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.user.userId) {
    throw new HttpException(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  if (!req.user.is_admin) {
    throw new HttpException(403, 'Admin access required', 'ADMIN_REQUIRED');
  }
  next();
};

/**
 * Seller authorization middleware
 * Checks if the authenticated user is a seller
 * Must be used after authenticate middleware
 * Seller type can be PRODUCER or ROASTER
 */
export const requireSeller = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.user || !req.user.userId) {
    throw new HttpException(401, 'Authentication required', 'AUTH_REQUIRED');
  }

  const isSeller = req.user.is_producer || req.user.is_roaster;
  if (!isSeller) {
    throw new HttpException(403, 'Seller access required', 'SELLER_REQUIRED');
  }
  next();
};

