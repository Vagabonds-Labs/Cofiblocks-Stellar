import { prisma } from '@/lib/prisma';

export interface CreateSessionEntry {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: string;
    expiresAt: Date;
  }

export interface SessionEntry {
    id: string;
    userId: string;
    ipAddress: string | null;
    userAgent: string | null;
    deviceInfo: string | null;
    isActive: boolean;
    lastActivity: Date;
    createdAt: Date;
    expiresAt: Date;
  }

export class DbSessions {
    async createSession(data: CreateSessionEntry): Promise<SessionEntry> {
        const session = await prisma.session.create({
            data: data,
            select: {
              id: true,
              userId: true,
              ipAddress: true,
              userAgent: true,
              deviceInfo: true,
              isActive: true,
              lastActivity: true,
              createdAt: true,
              expiresAt: true,
            },
          });

        return session;
    }

    async findSessionByRefreshToken(refreshToken: string): Promise<SessionEntry | null> {
        const session = await prisma.session.findFirst({
            where: {
                refreshToken: {
                    token: refreshToken,
                },
            },
            select: {
                id: true,
                userId: true,
                ipAddress: true,
                userAgent: true,
                deviceInfo: true,
                isActive: true,
                lastActivity: true,
                createdAt: true,
                expiresAt: true,
            },
        });

        return session;
    }

    async getUserSessions(userId: string): Promise<SessionEntry[]> {
        const sessions = await prisma.session.findMany({
            where: {
                userId,
                isActive: true,
                expiresAt: {
                    gt: new Date(), // Only non-expired sessions
                },
            },
            orderBy: {
                lastActivity: 'desc',
            },
            select: {
                id: true,
                userId: true,
                ipAddress: true,
                userAgent: true,
                deviceInfo: true,
                isActive: true,
                lastActivity: true,
                createdAt: true,
                expiresAt: true,
            },
        });

        return sessions;
    }

    async updateLastActivity(sessionId: string): Promise<void> {
        await prisma.session.update({
            where: { id: sessionId },
            data: {
                lastActivity: new Date(),
            },
        });
    }

    async deleteSession(sessionId: string): Promise<void> {
        await prisma.session.delete({
            where: { id: sessionId },
        });
    }

    async findSessionByRefreshTokenForRevoke(refreshToken: string): Promise<{ id: string } | null> {
        const session = await prisma.session.findFirst({
            where: {
                refreshToken: {
                    token: refreshToken,
                },
            },
            select: {
                id: true,
            },
        });

        return session;
    }

    async markAllSessionsInactive(userId: string): Promise<void> {
        await prisma.session.updateMany({
            where: { userId },
            data: { isActive: false },
        });
    }

    async cleanupExpiredSessions(): Promise<number> {
        const result = await prisma.session.updateMany({
            where: {
                expiresAt: {
                    lt: new Date(),
                },
                isActive: true,
            },
            data: {
                isActive: false,
            },
        });

        return result.count;
    }
}