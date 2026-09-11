"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const pending = searchParams.get("pending");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await signIn("credentials", { email, password, redirect: false });

    setLoading(false);
    if (res?.error) {
      setError("Invalid email or password");
      return;
    }
    router.push(callbackUrl);
  };

  return (
    <div className="mx-auto max-w-sm rounded-xl border bg-white p-6">
      <h1 className="mb-4 text-xl font-semibold">Log in</h1>

      {pending && (
        <p className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
          Your doctor account was created and is waiting for admin verification.
          You can log in now, but you will not appear in patient search until approved.
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input type="email" placeholder="Email" required
          className="w-full rounded border p-2 text-sm"
          value={email} onChange={(e) => setEmail(e.target.value)} />
        <input type="password" placeholder="Password" required
          className="w-full rounded border p-2 text-sm"
          value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button disabled={loading}
          className="w-full rounded bg-brand-500 py-2 font-medium text-white hover:bg-brand-600 disabled:opacity-50">
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="mt-3 text-sm text-gray-600">
        No account? <a href="/register" className="text-brand-600 underline">Sign up</a>
      </p>

      <div className="mt-4 rounded bg-gray-50 p-3 text-xs text-gray-500">
        <p className="font-medium">Demo accounts (all password123):</p>
        <p>patient@example.com — patient</p>
        <p>doctor@example.com — doctor</p>
        <p>admin@example.com — admin</p>
      </div>
    </div>
  );
}
