import { useState } from "react";
import { useLocation } from "wouter";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

import { Eye, EyeOff } from "lucide-react";

export default function SignIn() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  // ----------------------------
  // GOOGLE SIGN-IN
  // ----------------------------
  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);

      const result = await signInWithPopup(auth, googleProvider);
      const idToken = await result.user.getIdToken();

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error("Google token verification failed");

      toast({ title: "Welcome!", description: "Signed in with Google successfully" });
      setLocation("/");
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      toast({
        title: "Google Sign-in Failed",
        description: error.message ?? "Unable to authenticate",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  // EMAIL SIGN-IN / SIGN-UP
  // ----------------------------
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (!email || !password) {
      return toast({
        title: "Missing Fields",
        description: "Email and Password are required!",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    try {
      let userCredential;

      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }

      const idToken = await userCredential.user.getIdToken();

      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken }),
      });

      if (!res.ok) throw new Error("Token verification failed");

      toast({
        title: isSignUp ? "Account Created!" : "Welcome to TableTop!",
        description: isSignUp ? "Your account is ready." : "Successfully signed in!",
      });

      setLocation("/");
    } catch (error: any) {
      console.error("Auth error:", error);

      const map: Record<string, string> = {
        "auth/user-not-found": "No account found — please sign up.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/email-already-in-use": "Email already registered — try signing in.",
        "auth/weak-password": "Password must be at least 6 characters.",
      };
    
      toast({
        title: "Authentication Error",
        description: map[error.code] ?? error.message ?? "Authentication failed",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  // UI
  // ----------------------------
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">
            {isSignUp ? "Create Account" : "Sign In"}
          </CardTitle>
          <CardDescription className="text-center">
            {isSignUp
              ? "Create an account to manage your Pool Cafe"
              : "Sign in to access your dashboard"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* ---------------- Google Sign In ---------------- */}
          <Button
            onClick={handleGoogleSignIn}
            disabled={loading}
            variant="outline"
            className="w-full flex items-center justify-center gap-2"
          >
            <img
              src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
              className="w-5 h-5"
            />
            Continue with Google
          </Button>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator />
            </div>
            <div className="relative flex justify-center text-xs uppercase text-muted-foreground">
              <span className="bg-background px-2">Or continue with email</span>
            </div>
          </div>

          {/* ---------------- Email Form ---------------- */}
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            {/* Password */}
            <div className="space-y-1">
              <Label>Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full"
              size="lg"
            >
              {loading ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
            </Button>
          </form>

          {/* Toggle Sign In / Sign Up */}
          <p className="text-center text-sm text-muted-foreground mt-3">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp((prev) => !prev)}
              className="text-primary hover:underline"
              disabled={loading}
            >
              {isSignUp ? "Sign In" : "Create one"}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
