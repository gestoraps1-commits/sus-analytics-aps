import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import ChangePassword from "./pages/ChangePassword.tsx";
import PendingApproval from "./pages/PendingApproval.tsx";
import NotFound from "./pages/NotFound.tsx";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: 24 * 60 * 60 * 1000, // 24 horas
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const routerFutureConfig = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
} as const;

/**
 * Central access decision based on user status.
 * Returns the route the user should be on, or null if they can access the platform.
 */
function getRequiredRoute(appUser: { status: string; acesso: boolean; precisa_trocar_senha: boolean } | null): string | null {
  if (!appUser) return "/aguardando-aprovacao"; // no app_user record yet — block access
  if (appUser.precisa_trocar_senha) return "/trocar-senha";
  switch (appUser.status) {
    case "pendente_aprovacao":
    case "reprovado":
    case "bloqueado":
      return "/aguardando-aprovacao";
    case "aprovado":
      return appUser.acesso ? null : "/aguardando-aprovacao";
    default:
      return "/aguardando-aprovacao";
  }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  const requiredRoute = getRequiredRoute(appUser);
  if (requiredRoute) return <Navigate to={requiredRoute} replace />;

  return <>{children}</>;
}

function AppRoutes() {
  const { user, appUser, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If authenticated and approved, redirect away from public pages
  const isFullyApproved = user && appUser?.status === "aprovado" && appUser?.acesso && !appUser?.precisa_trocar_senha;

  return (
    <Routes>
      <Route path="/login" element={user ? (
        isFullyApproved ? <Navigate to="/" replace /> : <Navigate to={getRequiredRoute(appUser) || "/"} replace />
      ) : <Login />} />

      <Route path="/cadastro" element={user ? (
        isFullyApproved ? <Navigate to="/" replace /> : <Navigate to={getRequiredRoute(appUser) || "/"} replace />
      ) : <Register />} />

      <Route path="/trocar-senha" element={user ? <ChangePassword /> : <Navigate to="/login" replace />} />

      <Route path="/aguardando-aprovacao" element={
        !user ? <Navigate to="/login" replace /> :
        (isFullyApproved ? <Navigate to="/" replace /> : <PendingApproval />)
      } />

      <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={routerFutureConfig}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
