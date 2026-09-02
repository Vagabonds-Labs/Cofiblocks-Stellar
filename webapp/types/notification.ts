export interface Notification {
    id: string;
    receiverId: string;
    senderId: string | null;
    key: string;
    arguments: string[];
    level: string;
    readAt: Date | null;
    createdAt: Date;
    message?: string;
}