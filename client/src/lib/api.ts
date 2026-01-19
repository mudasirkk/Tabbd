import { auth } from "./firebaseClient";

const BASE = import.meta.env.VITE_API_BASE_URL || "";

export async function fetchWithAuth<T>(url: string, init: RequestInit = {}): Promise<T> {
    const user = auth.currentUser;
    if(!user) throw new Error("Not authenticated");
    const token = await user.getIdToken();

    const res = await fetch(`${BASE}${url}`, {
        ...init,
        headers: {
            ...(init.headers ?? {}),
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
    });

    if(!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Request failed: ${res.status}`);
    }

    if (res.status === 204) return undefined as unknown as T;
    return (await res.json()) as T;
}

export const postWithAuth = <T>(url: string, body?: unknown) =>
    fetchWithAuth<T>(url, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export const patchWithAuth = <T>(url: string, body?: unknown) =>
    fetchWithAuth<T>(url, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
  
  export const deleteWithAuth = <T>(url: string) =>
    fetchWithAuth<T>(url, { method: "DELETE" });