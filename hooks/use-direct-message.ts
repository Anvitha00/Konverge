"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { API_BASE } from "@/lib/api/base";
import { useAuthStore } from "@/store/auth-store";

interface DirectThreadResponse {
    thread: {
        thread_id: number;
    };
}

async function createDirectThreadRequest(user1Id: number, user2Id: number) {
    const response = await fetch(`${API_BASE}/threads/direct`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user1_id: user1Id, user2_id: user2Id }),
    });
    if (!response.ok) {
        throw new Error("Failed to create thread");
    }
    return response.json() as Promise<DirectThreadResponse>;
}

export function useDirectMessageLauncher() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    const mutation = useMutation({
        mutationFn: ({ targetUserId }: { targetUserId: number }) =>
            createDirectThreadRequest(user!.user_id ?? Number(user!.id), targetUserId),
        onSuccess: (data) => {
            toast.success("Opening chat...");
            queryClient.invalidateQueries({ queryKey: ["threads", user?.user_id] });
            router.push(`/chat?thread=${data.thread.thread_id}`);
        },
        onError: () => {
            toast.error("Failed to start chat. Make sure the chat service is online.");
        },
    });

    const startChat = (targetUser: number | string) => {
        if (!user?.user_id && !user?.id) {
            toast.error("Please log in to send messages");
            return;
        }
        const numericTarget = typeof targetUser === "number" ? targetUser : Number(targetUser);
        if (Number.isNaN(numericTarget)) {
            toast.error("Invalid user selected for chat");
            return;
        }
        mutation.mutate({ targetUserId: numericTarget });
    };

    return { startChat, isStartingChat: mutation.isPending };
}
