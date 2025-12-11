import { useAuth } from "@/contexts/AuthProvider";
import { Redirect } from "wouter";

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="p-4 text-center">Loading...</div>;

  if (!user) return <Redirect to="/signin" />;

  return children;
}
