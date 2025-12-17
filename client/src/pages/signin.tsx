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
      <Button
        onClick={async () => {
          const res = await fetch("/api/square/oauth/start", {
            credentials: "include",
          });

          if (!res.ok) {
            throw new Error("Failed to start Square OAuth");
          }

          const data = await res.json();

          const scopes =
            "MERCHANT_PROFILE_READ PAYMENTS_WRITE INVENTORY_READ ITEMS_READ DEVICE_CREDENTIAL_MANAGEMENT";

          const authUrl =
            `${data.baseURL}?` +
            `client_id=${data.appId}` +
            `&scope=${encodeURIComponent(scopes)}` +
            `&state=${encodeURIComponent(data.state)}` +
            `&redirect_uri=${encodeURIComponent(data.redirectUri)}`;

          // 🔥 THIS is the missing step
          window.location.href = authUrl;
        }}
      >
        Connect to Square
    </Button>
    </div>
  );
}