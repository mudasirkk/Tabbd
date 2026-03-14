import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useAuthReady } from "@/lib/useAuthReady";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTheme } from "@/hooks/useTheme";
import { Moon, Sun } from "lucide-react";

export default function SignIn() {

  const { ready: authReady, user } = useAuthReady();
  const { theme, toggleTheme } = useTheme();
  const[mode, setMode] = useState<"login" | "signup">("login");
  const[email, setEmail] = useState("");
  const[password, setPassword] = useState("");
  const[busy, setBusy] = useState(false);
  const[error, setError] = useState<string | null>(null);

  useEffect(() => {
    if(!authReady) return;
    if(user) window.location.replace("/dashboard");
  }, [authReady, user]);

  useEffect(() => {
    setEmail("");
    setPassword("");
    setError(null);
  }, [mode]);

  async function submit() {
    setError(null);
    setBusy(true);
    try{
      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      window.location.replace("/dashboard");
    } catch (e: any) {
      const code = e?.code ?? "";
      const friendly: Record<string, string> = {
        "auth/invalid-credential": "Invalid email or password.",
        "auth/email-already-in-use": "An account with this email already exists.",
        "auth/weak-password": "Password must be at least 6 characters.",
        "auth/too-many-requests": "Too many attempts. Try again later.",
      };
      setError(friendly[code] ?? "Authentication failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Atmospheric gradients */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/6 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-chart-2/5 rounded-full blur-3xl" />
      </div>

      {/* Theme toggle — top right */}
      <div className="absolute top-4 right-4">
        <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>

      <div className="relative w-full max-w-sm space-y-8">
        {/* Brand block */}
        <div className="text-center space-y-3">
          <h1 className="text-7xl font-bold font-display tracking-tight">Tabb'd</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login"
              ? "Welcome back. Log in to continue."
              : "Create your account to get started."}
          </p>
        </div>

        {/* Form */}
        <div className="rounded-xl border border-border/60 bg-card p-6 space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="space-y-4"
          >
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Password
                </label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2">
                  {error}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={busy || !email || password.length < 6}
            >
              {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
            </Button>
          </form>
        </div>

        {/* Mode switcher */}
        <p className="text-center text-sm text-muted-foreground">
          {mode === "login" ? (
            <>
              Don&apos;t have an account?{" "}
              <button
                className="text-primary underline underline-offset-4 font-medium hover:text-primary/80 transition-colors"
                onClick={() => setMode("signup")}
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                className="text-primary underline underline-offset-4 font-medium hover:text-primary/80 transition-colors"
                onClick={() => setMode("login")}
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
