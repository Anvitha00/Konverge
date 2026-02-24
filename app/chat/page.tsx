"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCircle, Search, Send, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/store/auth-store";
import { useUIStore } from "@/store/ui-store";
import {
  formatRelativeTime,
  formatDateTime,
  formatTime,
  formatDayLabel,
  getInitials,
} from "@/lib/utils";
import { toast } from "sonner";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useSearchParams } from "next/navigation";
import { API_BASE, WS_BASE } from "@/lib/api/base";

interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

interface Message {
  id: string;
  threadId: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender: User;
}

interface Thread {
  thread_id: string;
  title?: string;
  participants: User[];
  last_message?: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  };
  unread_count: number;
  created_at: string;
  updated_at: string;
}

const WS_URL = WS_BASE;
const API_URL = API_BASE;

// Stable, memoized child components to avoid remounts that can steal input focus
const ThreadsList = React.memo(function ThreadsListComponent({
  threads,
  threadsLoading,
  searchQuery,
  setSearchQuery,
  activeChatThread,
  setActiveChatThread,
  setChatSidebarOpen,
  user,
  reconnect,
  isConnected,
}: {
  threads: Thread[];
  threadsLoading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  activeChatThread?: string | null;
  setActiveChatThread: (id: string) => void;
  setChatSidebarOpen: (open: boolean) => void;
  user?: any;
  reconnect: () => void;
  isConnected: boolean;
}) {
  const filteredThreads = useMemo(() => {
    if (!searchQuery) return threads;
    const query = searchQuery.toLowerCase();
    return threads.filter(
      (thread) =>
        thread.title?.toLowerCase().includes(query) ||
        thread.participants.some((p) => p.name.toLowerCase().includes(query)),
    );
  }, [threads, searchQuery]);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Messages</h2>
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="ghost"
              onClick={reconnect}
              disabled={isConnected}
            >
              <RefreshCw
                className={`h-4 w-4 ${isConnected ? "" : "animate-spin"}`}
              />
            </Button>
            <div
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto space-y-2">
        {threadsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))
        ) : filteredThreads.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageCircle className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">
              {searchQuery ? "No conversations found" : "No conversations yet"}
            </p>
          </div>
        ) : (
          filteredThreads.map((thread) => {
            const otherParticipants = thread.participants.filter(
              (p) => p.id !== user?.user_id?.toString(),
            );
            const isActive = thread.thread_id === activeChatThread;
            return (
              <Card
                key={thread.thread_id}
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  isActive ? "bg-accent border-primary" : ""
                }`}
                onClick={() => {
                  setActiveChatThread(thread.thread_id);
                  setChatSidebarOpen(false);
                }}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={otherParticipants[0]?.avatar} />
                      <AvatarFallback>
                        {getInitials(otherParticipants[0]?.name || "")}
                      </AvatarFallback>
                    </Avatar>
                    {thread.unread_count > 0 && !isActive && (
                      <Badge className="absolute -right-2 -top-2 h-5 w-5 p-0 text-xs flex items-center justify-center">
                        {thread.unread_count}
                      </Badge>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium truncate">
                        {otherParticipants.map((p) => p.name).join(", ") ||
                          "Chat"}
                      </h3>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {thread.last_message &&
                          formatRelativeTime(thread.last_message.createdAt)}
                      </span>
                    </div>
                    {thread.last_message && (
                      <p className="text-sm text-muted-foreground truncate">
                        {thread.last_message.senderId ===
                        user?.user_id?.toString()
                          ? "You: "
                          : ""}
                        {thread.last_message.content}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </CardContent>
    </Card>
  );
});

const ChatWindow = React.memo(function ChatWindowComponent({
  activeThread,
  user,
  isConnected,
  currentThreadTypingUsers,
  messages,
  messagesLoading,
  messagesEndRef,
  inputRef,
  newMessage,
  handleInputChange,
  handleSendMessage,
  setChatSidebarOpen,
}: {
  activeThread?: Thread;
  user?: any;
  isConnected: boolean;
  currentThreadTypingUsers: User[];
  messages: Message[];
  messagesLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  newMessage: string;
  handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSendMessage: (e: React.FormEvent) => void;
  setChatSidebarOpen: (open: boolean) => void;
}) {
  return (
    <Card className="h-full flex flex-col">
      {activeThread ? (
        <>
          <div className="border-b p-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden"
                onClick={() => setChatSidebarOpen(true)}
              >
                <MessageCircle className="h-5 w-5" />
              </Button>
              <Avatar>
                <AvatarImage
                  src={
                    activeThread.participants.find(
                      (p) => p.id !== user?.user_id?.toString(),
                    )?.avatar
                  }
                />
                <AvatarFallback>
                  {getInitials(
                    activeThread.participants.find(
                      (p) => p.id !== user?.user_id?.toString(),
                    )?.name || "",
                  )}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <h3 className="font-semibold">
                  {activeThread.participants
                    .filter((p) => p.id !== user?.user_id?.toString())
                    .map((p) => p.name)
                    .join(", ")}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {currentThreadTypingUsers.length > 0 ? (
                    <span className="text-primary">typing...</span>
                  ) : (
                    <span>Active now</span>
                  )}
                </p>
              </div>
              {!isConnected && (
                <Badge variant="destructive" className="gap-1">
                  <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                  Reconnecting...
                </Badge>
              )}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messagesLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-12 w-3/4" />
                </div>
              ))
            ) : messages.length === 0 ? (
              <div className="flex h-full items-center justify-center text-center">
                <div>
                  <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
                  <h3 className="font-semibold">No messages yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Start the conversation by sending a message below.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {messages.map((message, index) => {
                  // ISSUE #2 FIX: Compare with both string and number
                  const isOwnMessage =
                    message.senderId === user?.user_id?.toString() ||
                    message.senderId == user?.user_id;
                  const showAvatar =
                    index === 0 ||
                    messages[index - 1].senderId !== message.senderId;
                  const currentLabel = formatDayLabel(message.createdAt);
                  const prevLabel =
                    index > 0
                      ? formatDayLabel(messages[index - 1].createdAt)
                      : null;
                  const showDaySeparator =
                    index === 0 || currentLabel !== prevLabel;
                  return (
                    <div key={message.id}>
                      {showDaySeparator && currentLabel !== "Today" && (
                        <div className="flex items-center gap-2 my-2">
                          <div className="h-px flex-1 bg-border" />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {currentLabel}
                          </span>
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      )}
                      <div
                        className={`flex gap-3 ${isOwnMessage ? "justify-end" : "justify-start"}`}
                      >
                        {!isOwnMessage &&
                          (showAvatar ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={message.sender.avatar} />
                              <AvatarFallback>
                                {getInitials(message.sender.name)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="h-8 w-8" />
                          ))}
                        <div
                          className={`flex flex-col ${isOwnMessage ? "items-end" : "items-start"} max-w-[70%]`}
                        >
                          {showAvatar && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium">
                                {isOwnMessage ? "You" : message.sender.name}
                              </span>
                            </div>
                          )}
                          <div
                            className={`rounded-2xl px-4 py-2 ${
                              isOwnMessage
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted"
                            }`}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>
                          <span className="mt-1 text-[11px] text-muted-foreground">
                            {formatTime(message.createdAt)}
                          </span>
                        </div>
                        {isOwnMessage &&
                          (showAvatar ? (
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={message.sender.avatar} />
                              <AvatarFallback>
                                {getInitials(message.sender.name)}
                              </AvatarFallback>
                            </Avatar>
                          ) : (
                            <div className="h-8 w-8" />
                          ))}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>
          <div className="border-t p-4 flex-shrink-0">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={handleInputChange}
                placeholder={
                  isConnected ? "Type your message..." : "Connecting..."
                }
                className="flex-1"
                disabled={!isConnected}
                maxLength={2000}
                autoComplete="off"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!isConnected || !newMessage.trim()}
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-center">
          <div>
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-50" />
            <h3 className="font-semibold">No conversation selected</h3>
            <p className="text-sm text-muted-foreground">
              Choose a conversation from the sidebar to start messaging.
            </p>
          </div>
        </div>
      )}
    </Card>
  );
});

export default function ChatPage() {
  const { user } = useAuthStore();
  const {
    activeChatThread,
    setActiveChatThread,
    isChatSidebarOpen,
    setChatSidebarOpen,
  } = useUIStore();
  const searchParams = useSearchParams();
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());

  const {
    data: threadsData,
    isLoading: threadsLoading,
    refetch: refetchThreads,
  } = useQuery({
    queryKey: ["threads", user?.user_id],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/threads/${user?.user_id}`);
      if (!res.ok) throw new Error("Failed to fetch threads");
      return res.json();
    },
    enabled: !!user?.user_id,
    refetchInterval: 30000,
  });

  const threads: Thread[] = threadsData?.threads || [];

  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["messages", activeChatThread],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/messages/${activeChatThread}`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      const json = await res.json();
      const normalized = (json?.messages || []).map((m: any) => ({
        id: m.id?.toString?.() ?? m.id,
        threadId:
          m.threadId?.toString?.() ??
          m.thread_id?.toString?.() ??
          activeChatThread,
        senderId:
          m.senderId?.toString?.() ??
          m.sender_id?.toString?.() ??
          m.sender?.id?.toString?.(),
        content: m.content ?? "",
        createdAt: m.createdAt ?? m.created_at ?? new Date().toISOString(),
        sender: {
          id: (m.sender?.id ?? m.senderId ?? m.sender_id)?.toString?.() ?? "",
          name: m.sender?.name ?? m.sender_name ?? "",
          email: m.sender?.email ?? "",
          avatar: m.sender?.avatar ?? undefined,
        },
      }));
      return { messages: normalized };
    },
    enabled: !!activeChatThread,
  });

  const messages: Message[] = messagesData?.messages || [];

  const handleWebSocketMessage = useCallback(
    (data: any) => {
      console.log("🎯 Received WebSocket message:", data);
      if (data.type === "new_message") {
        console.log(
          "💬 Processing new message for thread:",
          data.message.threadId,
        );

        queryClient.setQueryData(
          ["messages", data.message.threadId],
          (old: any) => {
            console.log("📦 Current messages cache:", old);
            if (!old) return { messages: [data.message] };

            const exists = old.messages.some(
              (m: Message) => m.id === data.message.id,
            );

            if (exists) {
              console.log("⚠️ Message already exists, skipping");
              return old;
            }

            console.log("✅ Adding new message to cache");
            return { messages: [...old.messages, data.message] };
          },
        );

        // Invalidate to force re-render
        queryClient.invalidateQueries({
          queryKey: ["messages", data.message.threadId],
        });
        refetchThreads();
      } else if (data.type === "thread_joined") {
        console.log("Joined thread:", data.thread_id);
      } else if (data.type === "user_typing") {
        if (data.is_typing) {
          setTypingUsers(
            (prev) => new Set(Array.from(prev).concat(data.user_id)),
          );
          setTimeout(() => {
            setTypingUsers((prev) => {
              const next = new Set(prev);
              next.delete(data.user_id);
              return next;
            });
          }, 3000);
        } else {
          setTypingUsers((prev) => {
            const next = new Set(prev);
            next.delete(data.user_id);
            return next;
          });
        }
      }
    },
    [queryClient, refetchThreads],
  );

  const {
    isConnected,
    sendMessage: sendWsMessage,
    reconnect,
  } = useWebSocket({
    url: WS_URL,
    userId: user?.user_id?.toString() || "",
    onMessage: handleWebSocketMessage,
    onConnect: () => {
      if (activeChatThread) {
        setTimeout(() => {
          sendWsMessage({ type: "join_thread", thread_id: activeChatThread });
        }, 500);
      }
    },
    onDisconnect: () => {
      console.log("Chat disconnected");
    },
  });

  useEffect(() => {
    if (isConnected && activeChatThread) {
      const timeout = setTimeout(() => {
        sendWsMessage({ type: "join_thread", thread_id: activeChatThread });
      }, 500);
      return () => clearTimeout(timeout);
    }
  }, [isConnected, activeChatThread, sendWsMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!searchParams) return;

    if (threads.length > 0 && !activeChatThread) {
      const threadId = searchParams.get("thread");

      if (threadId && threads.some((t) => t.thread_id === threadId)) {
        setActiveChatThread(threadId);
      } else {
        setActiveChatThread(threads[0].thread_id);
      }
    }
  }, [threads, activeChatThread, searchParams]);

  // ISSUE #3 FIX: Clear input when switching threads
  useEffect(() => {
    setNewMessage("");
    setIsTyping(false);
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [activeChatThread]);

  // Mark active thread as read locally (clear unread badge)
  useEffect(() => {
    if (!activeChatThread) return;
    queryClient.setQueryData(["threads", user?.user_id], (old: any) => {
      if (!old?.threads) return old;
      const updated = old.threads.map((t: Thread) =>
        t.thread_id === activeChatThread ? { ...t, unread_count: 0 } : t,
      );
      return { ...old, threads: updated };
    });
  }, [activeChatThread, messages?.length, user?.user_id, queryClient]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatThread || !isConnected || !user) {
      if (!isConnected) toast.error("Chat not connected. Please wait...");
      return;
    }

    const messageContent = newMessage.trim();
    const tempId = `temp-${Date.now()}-${Math.random()}`;

    // Create optimistic message for instant display
    const optimisticMessage: Message = {
      id: tempId,
      threadId: activeChatThread,
      senderId: user.user_id?.toString() || user.id?.toString() || "",
      content: messageContent,
      createdAt: new Date().toISOString(),
      sender: {
        id: user.user_id?.toString() || user.id?.toString() || "",
        name: user.name || "You",
        email: user.email || "",
        avatar: user.avatar,
      },
    };

    // Immediately add to cache for instant UI update
    queryClient.setQueryData(["messages", activeChatThread], (old: any) => {
      if (!old) return { messages: [optimisticMessage] };
      return { messages: [...old.messages, optimisticMessage] };
    });

    // Clear input immediately
    setNewMessage("");

    // Stop typing indicator
    if (isTyping) {
      setIsTyping(false);
      sendWsMessage({
        type: "typing",
        thread_id: activeChatThread,
        is_typing: false,
      });
    }

    // Send via WebSocket
    const success = sendWsMessage({
      type: "send_message",
      thread_id: activeChatThread,
      content: messageContent,
    });

    if (success) {
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      // Rollback optimistic update on failure
      toast.error("Failed to send message");
      setNewMessage(messageContent);
      queryClient.setQueryData(["messages", activeChatThread], (old: any) => {
        if (!old) return { messages: [] };
        return {
          messages: old.messages.filter((m: Message) => m.id !== tempId),
        };
      });
    }
  };

  // ISSUE #1 FIX: Optimized typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);

    if (!isConnected || !activeChatThread) return;

    // Send typing indicator only once when user starts typing
    if (!isTyping && value.length > 0) {
      setIsTyping(true);
      sendWsMessage({
        type: "typing",
        thread_id: activeChatThread,
        is_typing: true,
      });
    }

    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity or if input is empty
    if (value.length > 0) {
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        sendWsMessage({
          type: "typing",
          thread_id: activeChatThread,
          is_typing: false,
        });
      }, 2000);
    } else if (isTyping) {
      setIsTyping(false);
      sendWsMessage({
        type: "typing",
        thread_id: activeChatThread,
        is_typing: false,
      });
    }
  };

  const filteredThreads = threads.filter((thread) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      thread.title?.toLowerCase().includes(query) ||
      thread.participants.some((p) => p.name.toLowerCase().includes(query))
    );
  });

  const activeThread = threads.find((t) => t.thread_id === activeChatThread);
  const currentThreadTypingUsers =
    activeThread?.participants.filter(
      (p) => typingUsers.has(p.id) && p.id !== user?.user_id?.toString(),
    ) || [];

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <div className="lg:hidden w-full">
        {isChatSidebarOpen || !activeChatThread ? (
          <ThreadsList
            threads={threads}
            threadsLoading={threadsLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeChatThread={activeChatThread}
            setActiveChatThread={setActiveChatThread}
            setChatSidebarOpen={setChatSidebarOpen}
            user={user}
            reconnect={reconnect}
            isConnected={isConnected}
          />
        ) : (
          <ChatWindow
            activeThread={activeThread}
            user={user}
            isConnected={isConnected}
            currentThreadTypingUsers={currentThreadTypingUsers}
            messages={messages}
            messagesLoading={messagesLoading}
            messagesEndRef={messagesEndRef}
            inputRef={inputRef}
            newMessage={newMessage}
            handleInputChange={handleInputChange}
            handleSendMessage={handleSendMessage}
            setChatSidebarOpen={setChatSidebarOpen}
          />
        )}
      </div>
      <div className="hidden lg:flex w-full gap-6">
        <div className="w-80 flex-shrink-0">
          <ThreadsList
            threads={threads}
            threadsLoading={threadsLoading}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            activeChatThread={activeChatThread}
            setActiveChatThread={setActiveChatThread}
            setChatSidebarOpen={setChatSidebarOpen}
            user={user}
            reconnect={reconnect}
            isConnected={isConnected}
          />
        </div>
        <div className="flex-1">
          <ChatWindow
            activeThread={activeThread}
            user={user}
            isConnected={isConnected}
            currentThreadTypingUsers={currentThreadTypingUsers}
            messages={messages}
            messagesLoading={messagesLoading}
            messagesEndRef={messagesEndRef}
            inputRef={inputRef}
            newMessage={newMessage}
            handleInputChange={handleInputChange}
            handleSendMessage={handleSendMessage}
            setChatSidebarOpen={setChatSidebarOpen}
          />
        </div>
      </div>
    </div>
  );
}
