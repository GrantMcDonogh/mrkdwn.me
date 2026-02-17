import { useConvexAuth } from "convex/react";
import AuthPage from "./components/auth/AuthPage";
import VaultSelector from "./components/vault/VaultSelector";
import AppLayout from "./components/layout/AppLayout";
import { WorkspaceProvider, useWorkspace } from "./store/workspace";

function AppRouter() {
  const [state] = useWorkspace();

  if (!state.vaultId) {
    return <VaultSelector />;
  }

  return <AppLayout />;
}

export default function App() {
  const { isAuthenticated, isLoading } = useConvexAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-obsidian-bg flex items-center justify-center">
        <p className="text-obsidian-text-muted">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  return (
    <WorkspaceProvider>
      <AppRouter />
    </WorkspaceProvider>
  );
}
