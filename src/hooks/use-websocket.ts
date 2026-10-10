/**
 * Generic WebSocket hook for bidirectional JSON messaging.
 *
 * Manages connection lifecycle and provides a `send` function.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type WSStatus = "connecting" | "open" | "closed" | "error";

export function useWebSocket<T = unknown>(url: string | null) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<WSStatus>("closed");
  const [lastMessage, setLastMessage] = useState<T | null>(null);

  useEffect(() => {
    if (!url) return;

    setStatus("connecting");
    const ws = new WebSocket(url);

    ws.onopen = () => setStatus("open");
    ws.onclose = () => setStatus("closed");
    ws.onerror = () => setStatus("error");
    ws.onmessage = (e) => {
      try {
        setLastMessage(JSON.parse(e.data) as T);
      } catch {
        // ignore non-JSON messages
      }
    };

    wsRef.current = ws;

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [url]);

  const send = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  return { status, lastMessage, send };
}
