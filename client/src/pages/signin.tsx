import { useEffect } from "react";

export default function SignIn() {
  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((res) => {
        if (res.ok) {
          window.location.href = "/dashboard";
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <button
        className="px-6 py-3 rounded bg-black text-white text-lg"
        onClick={() => {
          window.location.href = "/api/square/oauth/start";
        }}
      >
        Sign in with Square
      </button>
    </div>
  );
}