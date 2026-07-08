import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { SSE_URL } from "../api/client";

/**
 * Opens a global SSE connection and invalidates relevant queries
 * on meaningful events (force_run_started, execution_started, execution_done, execution_pushed).
 */
export function useSSE() {
  const qc = useQueryClient();

  useEffect(() => {
    const es = new EventSource(SSE_URL);

    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        switch (event.type) {
          case "force_run_started":
            qc.invalidateQueries({ queryKey: ["runs"] });
            break;
          case "execution_started":
          case "execution_done":
          case "execution_pushed":
            qc.invalidateQueries({ queryKey: ["executions"] });
            qc.invalidateQueries({ queryKey: ["ideas"] });
            qc.invalidateQueries({ queryKey: ["stats"] });
            break;
        }
      } catch (_) {}
    };

    es.onerror = () => {
      // SSE will auto-reconnect — no action needed
    };

    return () => es.close();
  }, [qc]);
}
