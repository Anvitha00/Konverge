'use client';

import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuthStore } from '@/store/auth-store';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const { user } = useAuthStore();
  
  useEffect(() => {
    if (!user) return;
    
    // Initialize socket connection
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'ws://localhost:3001', {
      auth: {
        userId: user.id,
      },
    });
    
    const socket = socketRef.current;
    
    socket.on('connect', () => {
      setIsConnected(true);
    });
    
    socket.on('disconnect', () => {
      setIsConnected(false);
    });
    
    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user]);
  
  return {
    socket: socketRef.current,
    isConnected,
  };
}

export function usePresence() {
  const { socket } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('user-online', (userId: string) => {
      setOnlineUsers(prev => (prev.includes(userId) ? prev : [...prev, userId]));
    });
    
    socket.on('user-offline', (userId: string) => {
      setOnlineUsers(prev => prev.filter(id => id !== userId));
    });
    
    socket.on('online-users', (users: string[]) => {
      setOnlineUsers(users);
    });
    
    return () => {
      socket.off('user-online');
      socket.off('user-offline');
      socket.off('online-users');
    };
  }, [socket]);
  
  return { onlineUsers };
}

export function useTyping(threadId: string) {
  const { socket } = useSocket();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('typing', ({ userId, threadId: tid }: { userId: string; threadId: string }) => {
      if (tid === threadId) {
        setTypingUsers(prev => (prev.includes(userId) ? prev : [...prev, userId]));
      }
    });
    
    socket.on('stop-typing', ({ userId, threadId: tid }: { userId: string; threadId: string }) => {
      if (tid === threadId) {
        setTypingUsers(prev => prev.filter(id => id !== userId));
      }
    });
    
    return () => {
      socket.off('typing');
      socket.off('stop-typing');
    };
  }, [socket, threadId]);
  
  const startTyping = () => {
    socket?.emit('typing', { threadId });
  };
  
  const stopTyping = () => {
    socket?.emit('stop-typing', { threadId });
  };
  
  return { typingUsers, startTyping, stopTyping };
}

export function useMessages(threadId: string) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState<any[]>([]);
  
  useEffect(() => {
    if (!socket) return;
    
    socket.on('message', (message: any) => {
      if (message.threadId === threadId) {
        setMessages(prev => [...prev, message]);
      }
    });
    
    return () => {
      socket.off('message');
    };
  }, [socket, threadId]);
  
  return { messages };
}