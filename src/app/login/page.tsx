"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import SupabaseSetup from "@/components/supabase-setup";
import { supabase } from "@/lib/supabase";

export default function Login() {
  if (!supabase) return <SupabaseSetup />;
  return <LoginForm client={supabase} />;
}

function LoginForm({ client }: { client: SupabaseClient }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (active && data.session) router.replace("/dashboard");
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "We could not check your session. Please sign in again.");
        }
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    void checkSession();
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      if (active && session) router.replace("/dashboard");
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [client, router]);

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading || checkingSession) return;
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      if (isLogin) {
        const { data, error: authError } = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (authError) throw authError;
        if (!data.session) throw new Error("No sign-in session was created. Please try again.");
        router.replace("/dashboard");
      } else {
        const { data, error: authError } = await client.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace("/dashboard");
        } else {
          setNotice("Check your email for a confirmation link, then return here to sign in.");
          setIsLogin(true);
          setPassword("");
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Authentication failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-800">
      <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-6 text-center text-2xl font-bold">
          {isLogin ? "Welcome Back" : "Create Account"}
        </h1>

        {error && (
          <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600" role="alert">{error}</p>
        )}
        {notice && (
          <p className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800" role="status">{notice}</p>
        )}
        {checkingSession && (
          <p className="mb-4 text-sm text-gray-600" role="status">Checking your session...</p>
        )}

        <form onSubmit={handleAuth} className="space-y-4" aria-busy={loading || checkingSession}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={loading || checkingSession}
              required
              className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={loading || checkingSession}
              required
              className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
            />
          </div>
          <button
            type="submit"
            disabled={loading || checkingSession}
            className="w-full rounded-md bg-blue-600 py-2 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
          >
            {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-600">
          {isLogin ? "Don’t have an account? " : "Already have an account? "}
          <button
            type="button"
            disabled={loading || checkingSession}
            onClick={() => {
              setIsLogin((value) => !value);
              setError(null);
              setNotice(null);
            }}
            className="font-medium text-blue-600 hover:underline disabled:opacity-50"
          >
            {isLogin ? "Sign up" : "Sign in"}
          </button>
        </p>
      </section>
    </main>
  );
}
