import { useEffect, useState } from "react";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { useAuthReady } from "@/lib/useAuthReady";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export default function SignIn() {

  const { ready: authReady, user } = useAuthReady();
  const[mode, setMode] = useState<"login" | "signup">("login");
  const[email, setEmail] = useState("");
  const[password, setPassword] = useState("");
  const[busy, setBusy] = useState(false);
  const[error, setError] = useState<string | null>(null);

  useEffect(() => {
    if(!authReady) return;
    if(user) window.location.replace("/dashboard");
  }, [authReady, user]);

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
      setError(e?.message ?? "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Tabb’d</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "login" ? "Log in to your account" : "Create a new account"}
          </p>
        </div>

        <div className="space-y-2">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <Button className="w-full" onClick={submit} disabled={busy || !email || password.length < 6}>
          {busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"}
        </Button>

        <div className="text-sm text-muted-foreground">
          {mode === "login" ? (
            <button className="underline" onClick={() => setMode("signup")}>Need an account? Sign up</button>
          ) : (
            <button className="underline" onClick={() => setMode("login")}>Already have an account? Log in</button>
          )}
        </div>
      </Card>
    </div>
  );
}