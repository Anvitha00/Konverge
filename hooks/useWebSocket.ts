// hooks/useWebSocket.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseWebSocketOptions {
  url: string;
  userId: string;
  onMessage?: (data: WebSocketMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
}

export function useWebSocket({
  url,
  userId,
  onMessage,
  onConnect,
  onDisconnect,
  reconnectInterval = 3000,
  maxReconnectAttempts = 5,
}: UseWebSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const shouldReconnectRef = useRef(true);
  const connectionReadyRef = useRef(false);

  const connect = useCallback(() => {
    if (!userId || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Cleanup old connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    try {
      console.log('🔌 Connecting to WebSocket:', `${url}/${userId}`);
      const websocket = new WebSocket(`${url}/${userId}`);
      connectionReadyRef.current = false;

      websocket.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        setReconnectAttempts(0);
        connectionReadyRef.current = true;
        
        // Small delay before calling onConnect to ensure connection is stable
        setTimeout(() => {
          onConnect?.();
        }, 100);
      };

      websocket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 WebSocket message:', data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      websocket.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        connectionReadyRef.current = false;
      };

      websocket.onclose = (event) => {
        console.log('🔌 WebSocket disconnected', event.code, event.reason);
        setIsConnected(false);
        connectionReadyRef.current = false;
        wsRef.current = null;
        onDisconnect?.();

        // Only attempt to reconnect if not manually closed and under attempt limit
        if (shouldReconnectRef.current && reconnectAttempts < maxReconnectAttempts && event.code !== 1000) {
          const delay = reconnectInterval * Math.pow(1.5, reconnectAttempts);
          console.log(`🔄 Reconnecting in ${delay}ms... (attempt ${reconnectAttempts + 1}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          toast.error('Failed to reconnect. Please refresh the page.');
        }
      };

      wsRef.current = websocket;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      toast.error('Failed to connect to chat');
    }
  }, [url, userId, onMessage, onConnect, onDisconnect, reconnectInterval, maxReconnectAttempts, reconnectAttempts]);

  const disconnect = useCallback(() => {
    shouldReconnectRef.current = false;
    connectionReadyRef.current = false;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close(1000, 'Manual disconnect'); // 1000 = normal closure
      wsRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((message: WebSocketMessage) => {
    // Check if connection is ready
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !connectionReadyRef.current) {
      console.warn('WebSocket not ready, message queued');
      toast.error('Chat not connected');
      return false;
    }

    try {
      const payload = JSON.stringify(message);
      console.log('📤 Sending message:', message);
      wsRef.current.send(payload);
      return true;
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message');
      return false;
    }
  }, []);

  // Connect on mount
  useEffect(() => {
    if (!userId) {
      console.warn('No userId provided, skipping WebSocket connection');
      return;
    }

    shouldReconnectRef.current = true;
    
    // Small delay to ensure component is mounted
    const timeout = setTimeout(() => {
      connect();
    }, 100);

    return () => {
      clearTimeout(timeout);
      shouldReconnectRef.current = false;
      disconnect();
    };
  }, [userId]); // Only reconnect when userId changes

  return {
    isConnected,
    sendMessage,
    disconnect,
    reconnect: connect,
  };
}