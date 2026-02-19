"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

import { useAuthStore } from "@/store/auth-store";
import type { AuthUser, User } from "@/types";

export function SessionSync() {
  const { data, status } = useSession();
  const setUser = useAuthStore((state) => state.setUser);
  const setLoading = useAuthStore((state) => state.setLoading);
  const currentUser = useAuthStore((state) => state.user);

  useEffect(() => {
    setLoading(status === "loading");

    if (status === "authenticated" && data?.user) {
      const sessionUser = data.user as AuthUser;

      const isAdmin = (sessionUser as AuthUser & { isAdmin?: boolean }).isAdmin ?? false;
      if (sessionUser.user_id !== currentUser?.user_id || (currentUser as User & { isAdmin?: boolean })?.isAdmin !== isAdmin) {
        setUser({
          id: sessionUser.id ?? String(sessionUser.user_id),
          user_id: sessionUser.user_id,
          name: sessionUser.name,
          email: sessionUser.email,
          skills: sessionUser.skills ?? [],
          bio: sessionUser.bio ?? undefined,
          links: sessionUser.links
            ? {
                github: sessionUser.links.github ?? undefined,
                linkedin: sessionUser.links.linkedin ?? undefined,
                portfolio: sessionUser.links.portfolio ?? undefined,
              }
            : undefined,
          rating: sessionUser.rating ?? undefined,
          engagement_score: sessionUser.engagement_score ?? undefined,
          availability: sessionUser.availability ?? "available",
          badges: sessionUser.badges ?? [],
          points: sessionUser.points ?? 0,
          joinedAt: sessionUser.joinedAt,
          isAdmin,
        });
      }
    }

    if (status === "unauthenticated") {
      setUser(null);
    }
  }, [currentUser?.user_id, data, setLoading, setUser, status]);

  return null;
}
