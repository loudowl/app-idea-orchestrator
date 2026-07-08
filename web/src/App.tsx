import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Dashboard from "./pages/Dashboard";
import { useSSE } from "./hooks/useSSE";

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

function AppInner() {
  useSSE(); // Global SSE for real-time invalidations
  return <Dashboard />;
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <AppInner />
    </QueryClientProvider>
  );
}
