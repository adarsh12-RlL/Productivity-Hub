"use client";

import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import SupabaseSetup from "@/components/supabase-setup";
import { supabase } from "@/lib/supabase";

export default function Home() {
  if (!supabase) return <SupabaseSetup />;
  return <HomeRedirect client={supabase} />;
}

function HomeRedirect({ client }: { client: SupabaseClient }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        if (active) router.replace(data.session ? "/dashboard" : "/login");
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : "We could not check your session. Please try again.");
        }
      }
    }

    void checkSession();
    return () => {
      active = false;
    };
  }, [client, router, attempt]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-800">
      {error ? (
        <section className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
          <h1 className="mb-3 text-xl font-bold">Unable to open your workspace</h1>
          <p className="mb-4 text-sm text-red-600" role="alert">{error}</p>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setAttempt((value) => value + 1);
            }}
            className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Try again
          </button>
        </section>
      ) : (
        <p className="animate-pulse text-lg font-semibold text-blue-600" role="status">
          Loading AI Productivity Hub...
        </p>
      )}
    </main>
  );
}
