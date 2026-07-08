import { useEffect, useRef, useState } from "react";
import { WS_URL } from "../api/client";

export interface WSEvent {
  type: string;
  agent: string;
  data: string;
  executionId?: string;
}

/**
 * Opens a WebSocket connection to the orchestrator's relay for a specific execution.
 * Returns the stream of agent events and a connection status.
 */
export function useExecutionWS(executionId: string | null) {
  const [events, setEvents] = useState<WSEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!executionId) return;

    const url = `${WS_URL}?executionId=${executionId}`;
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => setConnected(true);
    socket.onclose = () => setConnected(false);
    socket.onerror = () => setConnected(false);

    socket.onmessage = (e) => {
      try {
        const event: WSEvent = JSON.parse(e.data);
        setEvents((prev) => [...prev, event]);
      } catch (_) {}
    };

    return () => {
      socket.close();
      ws.current = null;
    };
  }, [executionId]);

  const reset = () => setEvents([]);

  return { events, connected, reset };
}
