import type { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcrypt';

import pool from '@/lib/db';
import type { AuthUser } from '@/types';

const nextAuthSecret =
    process.env.NEXTAUTH_SECRET ??
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV === 'development' ? 'dev-secret' : undefined);

if (!nextAuthSecret) {
    throw new Error(
        'NEXTAUTH_SECRET (or AUTH_SECRET) must be set in the environment. See README for setup instructions.'
    );
}

const mapDbUserToUser = (dbUser: any): AuthUser => ({
    id: String(dbUser.user_id),
    user_id: dbUser.user_id,
    name: dbUser.name,
    email: dbUser.email,
    skills: dbUser.skills ?? [],
    bio: dbUser.bio ?? undefined,
    links: {
        github: dbUser.github ?? undefined,
        linkedin: dbUser.linkedin ?? undefined,
    },
    rating: dbUser.rating ?? undefined,
    engagement_score: dbUser.engagement_score ?? undefined,
    availability: 'available',
    badges: [],
    points: dbUser.engagement_score ?? 0,
    joinedAt: undefined,
});

export const authOptions: NextAuthOptions = {
    session: {
        strategy: 'jwt',
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: nextAuthSecret,
    pages: {
        signIn: '/auth',
    },
    providers: [
        CredentialsProvider({
            name: 'Email & Password',
            credentials: {
                email: { label: 'Email', type: 'email' },
                password: { label: 'Password', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    throw new Error('Email and password are required');
                }

                const normalizedEmail = credentials.email.trim().toLowerCase();

                const userResult = await pool.query(
                    `SELECT 
            user_id, name, email, password_hash, skills, bio, github, linkedin, rating, engagement_score
           FROM users
           WHERE email = $1`,
                    [normalizedEmail]
                );

                if (userResult.rows.length === 0) {
                    throw new Error('Invalid email or password');
                }

                const dbUser = userResult.rows[0];
                const isValid = await bcrypt.compare(credentials.password, dbUser.password_hash);

                if (!isValid) {
                    throw new Error('Invalid email or password');
                }

                return mapDbUserToUser(dbUser);
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.user = user as AuthUser;
                const adminEmails = (process.env.ADMIN_EMAILS ?? '')
                    .split(',')
                    .map((e) => e.trim().toLowerCase())
                    .filter(Boolean);
                const email = (user as AuthUser & { email?: string }).email?.trim().toLowerCase();
                (token.user as AuthUser & { isAdmin?: boolean }).isAdmin =
                    Boolean(email && adminEmails.includes(email));
            }
            return token;
        },
        async session({ session, token }) {
            if (token.user) {
                session.user = { ...token.user } as AuthUser & { isAdmin?: boolean };
            }
            return session;
        },
    },
    cookies: {
        sessionToken: {
            name:
                process.env.NODE_ENV === 'production'
                    ? '__Secure-next-auth.session-token'
                    : 'next-auth.session-token',
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
            },
        },
    },
};

export const getServerAuthSession = () => getServerSession(authOptions);
