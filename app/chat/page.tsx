'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Search, Users, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getThreads, getMessages, sendMessage } from '@/lib/api/chat';
import { useAuthStore } from '@/store/auth-store';
import { useUIStore } from '@/store/ui-store';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import type { Thread, Message } from '@/types';

export default function ChatPage() {
  const { user } = useAuthStore();
  const { activeChatThread, setActiveChatThread, isChatSidebarOpen, setChatSidebarOpen } = useUIStore();
  const [newMessage, setNewMessage] = useState('');
  
  const { data: threads, isLoading: threadsLoading } = useQuery({
    queryKey: ['threads', user?.id],
    queryFn: () => getThreads(user?.id!),
    enabled: !!user,
  });
  
  const { data: messages, isLoading: messagesLoading } = useQuery({
    queryKey: ['messages', activeChatThread],
    queryFn: () => getMessages(activeChatThread!),
    enabled: !!activeChatThread,
  });
  
  const activeThread = threads?.find(t => t.id === activeChatThread);
  
  useEffect(() => {
    if (threads?.length && !activeChatThread) {
      setActiveChatThread(threads[0].id);
    }
  }, [threads, activeChatThread, setActiveChatThread]);
  
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChatThread || !user) return;
    
    try {
      await sendMessage(activeChatThread, newMessage, user.id);
      setNewMessage('');
      // In a real app, this would trigger a refetch or use optimistic updates
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };
  
  const ThreadsList = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Messages</h2>
        <Button size="icon" variant="ghost" className="lg:hidden">
          <Users className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search conversations..." className="pl-10" />
      </div>
      
      <div className="space-y-2">
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
        ) : (
          threads?.map((thread) => {
            const otherParticipants = thread.participants.filter(p => p.id !== user?.id);
            const isActive = thread.id === activeChatThread;
            
            return (
              <Card
                key={thread.id}
                className={`cursor-pointer transition-colors hover:bg-accent/50 ${
                  isActive ? 'bg-accent' : ''
                }`}
                onClick={() => {
                  setActiveChatThread(thread.id);
                  setChatSidebarOpen(false);
                }}
              >
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="relative">
                    <Avatar>
                      <AvatarImage src={otherParticipants[0]?.avatar} />
                      <AvatarFallback>
                        {getInitials(otherParticipants[0]?.name || '')}
                      </AvatarFallback>
                    </Avatar>
                    {thread.unreadCount > 0 && (
                      <Badge className="absolute -right-2 -top-2 h-5 w-5 p-0 text-xs">
                        {thread.unreadCount}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate">
                        {thread.title || otherParticipants.map(p => p.name).join(', ')}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {thread.lastMessage && formatRelativeTime(thread.lastMessage.createdAt)}
                      </span>
                    </div>
                    
                    {thread.lastMessage && (
                      <p className="text-sm text-muted-foreground truncate">
                        {thread.lastMessage.content}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
  
  const ChatWindow = () => (
    <div className="flex h-full flex-col">
      {activeThread ? (
        <>
          <div className="border-b p-4">
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
                  src={activeThread.participants.find(p => p.id !== user?.id)?.avatar} 
                />
                <AvatarFallback>
                  {getInitials(
                    activeThread.participants.find(p => p.id !== user?.id)?.name || ''
                  )}
                </AvatarFallback>
              </Avatar>
              
              <div>
                <h3 className="font-semibold">
                  {activeThread.title || 
                   activeThread.participants
                     .filter(p => p.id !== user?.id)
                     .map(p => p.name)
                     .join(', ')
                  }
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeThread.participants.length} participant{activeThread.participants.length !== 1 ? 's' : ''}
                </p>
              </div>
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
            ) : (
              messages?.map((message) => {
                const isOwnMessage = message.senderId === user?.id;
                
                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${isOwnMessage ? 'flex-row-reverse' : ''}`}
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={message.sender.avatar} />
                      <AvatarFallback>{getInitials(message.sender.name)}</AvatarFallback>
                    </Avatar>
                    
                    <div className={`max-w-[70%] ${isOwnMessage ? 'text-right' : ''}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">{message.sender.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(message.createdAt)}
                        </span>
                      </div>
                      
                      <div
                        className={`rounded-lg px-3 py-2 ${
                          isOwnMessage
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm">{message.content}</p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          
          <div className="border-t p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1"
              />
              <Button type="submit" size="icon">
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex h-full items-center justify-center text-center">
          <div>
            <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold">No conversation selected</h3>
            <p className="text-sm text-muted-foreground">
              Choose a conversation from the sidebar to start messaging.
            </p>
          </div>
        </div>
      )}
    </div>
  );
  
  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Mobile: Full width threads list or chat */}
      <div className="lg:hidden w-full">
        {isChatSidebarOpen || !activeChatThread ? (
          <ThreadsList />
        ) : (
          <ChatWindow />
        )}
      </div>
      
      {/* Desktop: Side-by-side layout */}
      <div className="hidden lg:flex w-full gap-6">
        <Card className="w-80 flex-shrink-0">
          <CardHeader>
            <ThreadsList />
          </CardHeader>
        </Card>
        
        <Card className="flex-1">
          <ChatWindow />
        </Card>
      </div>
    </div>
  );
}