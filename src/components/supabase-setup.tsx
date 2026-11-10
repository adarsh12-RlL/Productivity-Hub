import { supabaseConfigurationError } from "@/lib/supabase";

export default function SupabaseSetup() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4 text-gray-800">
      <section className="w-full max-w-lg rounded-xl bg-white p-8 shadow-lg">
        <h1 className="mb-3 text-2xl font-bold">Connect your Productivity Hub</h1>
        <p className="mb-6 text-sm text-gray-600">
          Connect Supabase to sign in and save your tasks and notes across devices.
        </p>
        <p className="mb-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800" role="status">
          {supabaseConfigurationError ?? "Supabase configuration is required."}
        </p>
        <ol className="list-decimal space-y-3 pl-5 text-sm text-gray-700">
          <li>Create a Supabase project and copy its URL and publishable key from the Connect dialog.</li>
          <li>
            Set <code className="break-all">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="break-all">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in the project&apos;s{" "}
            <code>.env.local</code> file.
          </li>
          <li>Restart the development server, then reload this page.</li>
        </ol>
      </section>
    </main>
  );
}
