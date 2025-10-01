import type { Thread, Message } from '@/types';
import { mockThreads, mockMessages } from './mock-data';

export async function getThreads(userId: string): Promise<Thread[]> {
  return mockThreads.filter(thread => 
    thread.participants.some(p => p.id === userId)
  );
}

export async function getMessages(threadId: string): Promise<Message[]> {
  return mockMessages.filter(m => m.threadId === threadId);
}

export async function sendMessage(
  threadId: string,
  content: string,
  senderId: string
): Promise<Message> {
  const newMessage: Message = {
    id: Math.random().toString(36).substring(2),
    threadId,
    senderId,
    content,
    type: 'text',
    createdAt: new Date(),
    sender: mockThreads.find(t => t.id === threadId)?.participants.find(p => p.id === senderId)!,
    readBy: [senderId],
  };
  
  mockMessages.push(newMessage);
  
  // Update thread's lastMessage
  const thread = mockThreads.find(t => t.id === threadId);
  if (thread) {
    thread.lastMessage = newMessage;
    thread.updatedAt = new Date();
  }
  
  return newMessage;
}