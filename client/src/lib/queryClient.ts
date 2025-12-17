import { QueryClient, QueryFunction } from "@tanstack/react-query";

/* ============================= Helpers ============================= */

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/* ============================= API REQUEST ============================= */
/**
 * Session-based API request helper
 * - NO auth headers
 * - Cookies only
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<any> {
  const headers: Record<string, string> = {};

  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: "include", // 🔐 session cookie
  });

  await throwIfResNotOk(res);

  if (res.status === 204) {
    return null;
  }

  return res.json();
}

/* ============================= QUERY FN ============================= */
/**
 * Default query function for TanStack Query
 * - Uses queryKey as URL
 * - Handles 401 explicitly
 */
export const getQueryFn: <T>() => QueryFunction<T> =
  () =>
  async ({ queryKey }) => {
    const url = queryKey.join("/") as string;

    const res = await fetch(url, {
      credentials: "include", // 🔐 session cookie
    });

    if (res.status === 401) {
      throw new Error("401: Unauthorized");
    }

    await throwIfResNotOk(res);
    return res.json();
  };

/* ============================= QUERY CLIENT ============================= */

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn(),
      refetchOnWindowFocus: false,
      refetchInterval: false,
      staleTime: 0,
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message.includes("401")) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: 1000,
    },
    mutations: {
      retry: false,
    },
  },
});

/* ============================= 🔒 GLOBAL 401 HANDLER ============================= */
/**
 * Redirect to /signin on ANY unauthorized response
 * This guarantees session-only auth safety app-wide
 */
queryClient.getQueryCache().subscribe((event) => {
  const error = event?.query?.state?.error;

  if (
    error instanceof Error &&
    error.message.includes("401") &&
    window.location.pathname !== "/signin"
  ) {
    window.location.href = "/signin";
  }
});