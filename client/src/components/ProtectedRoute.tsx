import { useQuery } from "@tanstack/react-query";

export default function ProtectedRoute({
  children,
}: {
  children: JSX.Element;
}) {
  const { isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  if (isLoading) {
    return <div className="p-4 text-center">Loading...</div>;
  }

  // If unauthorized:
  // - /api/auth/me returns 401
  // - query throws
  // - global 401 handler redirects to /signin
  return children;
}
