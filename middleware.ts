export { default } from "next-auth/middleware";

export const config = {
    matcher: [
        "/",
        "/admin/:path*",
        "/chat/:path*",
        "/leaderboard/:path*",
        "/matched/:path*",
        "/profile/:path*",
        "/projects/:path*",
        "/auth/onboarding",
    ],
};
