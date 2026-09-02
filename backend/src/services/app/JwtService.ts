import jwt from 'jsonwebtoken';
import { TokenPayload, TokenPair } from './types/Auth';

export class JwtService {
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly accessTokenExpiry: string;
  private readonly refreshTokenExpiry: string;

  constructor() {
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || 'your-access-secret-change-in-production';
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-change-in-production';
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '10m'; // 10 minutes
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d'; // 7 days
  }

  /**
   * Generate access token (short-lived)
   */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(
      {
        userId: payload.userId,
        walletAddress: payload.walletAddress,
        is_admin: payload.is_admin,
        is_producer: payload.is_producer,
        is_roaster: payload.is_roaster,
        type: 'access',
      },
      this.accessTokenSecret,
      {
        expiresIn: this.accessTokenExpiry,
      } as jwt.SignOptions
    );
  }

  /**
   * Generate refresh token as JWT (long-lived, stored in DB for revocation)
   */
  generateRefreshToken(payload: TokenPayload & { sessionId?: string }): string {
    return jwt.sign(
      {
        userId: payload.userId,
        walletAddress: payload.walletAddress,
        is_admin: payload.is_admin,
        is_producer: payload.is_producer,
        is_roaster: payload.is_roaster,
        sessionId: payload.sessionId,
        type: 'refresh',
      },
      this.refreshTokenSecret,
      {
        expiresIn: this.refreshTokenExpiry,
      } as jwt.SignOptions
    );
  }

  /**
   * Generate both access and refresh tokens
   */
  generateTokenPair(payload: TokenPayload & { sessionId?: string }): TokenPair {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
    };
  }

  /**
   * Verify refresh token
   */
  verifyRefreshToken(token: string): (TokenPayload & { sessionId?: string }) | null {
    try {
      const decoded = jwt.verify(token, this.refreshTokenSecret) as jwt.JwtPayload;
      
      if (decoded.type !== 'refresh') {
        return null;
      }

      return {
        userId: decoded.userId as string,
        walletAddress: decoded.walletAddress as string,
        is_admin: decoded.is_admin as boolean,
        is_producer: decoded.is_producer as boolean,
        is_roaster: decoded.is_roaster as boolean,
        sessionId: decoded.sessionId as string | undefined,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify access token
   */
  verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.accessTokenSecret) as jwt.JwtPayload;
      
      if (decoded.type !== 'access') {
        return null;
      }

      return {
        userId: decoded.userId as string,
        walletAddress: decoded.walletAddress as string,
        is_admin: decoded.is_admin as boolean,
        is_producer: decoded.is_producer as boolean,
        is_roaster: decoded.is_roaster as boolean,
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Get refresh token expiry date
   */
  getRefreshTokenExpiryDate(): Date {
    const expiryDays = parseInt(this.refreshTokenExpiry.replace('d', '')) || 7;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);
    return expiryDate;
  }
}

