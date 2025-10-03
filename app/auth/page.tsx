"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function AuthPage() {
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) {
      setError("Please enter your UserID or Email.");
      return;
    }
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input);
    if (!isEmail) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: input })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed.");
        return;
      }
      // Save user to localStorage or context if needed
      // Redirect to discover page
      router.push("/projects");
    } catch (err) {
      setError("Server error. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Login to Konverge
          </h1>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <input
              type="text"
              placeholder="UserID or Email"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="border rounded px-4 py-2 focus:outline-none focus:ring focus:border-primary"
              autoFocus
            />
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <Button type="submit" size="lg" className="w-full">
              Login
            </Button>
          </form>
          <div className="mt-4 text-center">
            <a href="/auth/register" className="text-primary hover:underline">
              Don't have an account? Register
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
