import NextAuth, { DefaultSession } from 'next-auth';

declare module 'next-auth' {
    interface Session {
        user: {
            id: string;
            user_id: number;
            name: string;
            email: string;
            skills: string[];
            bio?: string | null;
            links?: {
                github?: string | null;
                linkedin?: string | null;
            };
            rating?: number | null;
            engagement_score?: number | null;
            isAdmin?: boolean;
        } & DefaultSession['user'];
    }

    interface User extends Session['user'] { }
}

declare module 'next-auth/jwt' {
    interface JWT {
        user?: Session['user'];
    }
}
