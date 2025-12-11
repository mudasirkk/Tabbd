// client/src/components/ProtectedRoute.tsx
import { useAuth } from "@/contexts/AuthProvider";
import { Redirect } from "wouter";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) return <div>Loading...</div>;

  if (!user) return <Redirect to="/signin" />;

  return children;
}
