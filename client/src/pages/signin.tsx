import { useEffect } from "react";
import { Button } from "@/components/ui/button";

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
      <Button onClick={() => {
        window.location.href = "/api/square/oauth/start";
      }}>
        Connect to Square
      </Button>
    </div>
  );
}