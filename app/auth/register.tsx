"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    // Basic email validation
    if (!email.trim()) {
      setError("Please enter your email.");
      return;
    }
    const isEmail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
    if (!isEmail) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    // Call backend API to register user
    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        setSuccess("Registration successful! You can now login.");
        setEmail("");
        // Optionally redirect to login
        // router.push("/auth");
      } else {
        const data = await res.json();
        setError(data.error || "Registration failed.");
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">Register</h1>
          <form onSubmit={handleRegister} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border rounded px-4 py-2 focus:outline-none focus:ring focus:border-primary"
              autoFocus
            />
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {success && <div className="text-green-500 text-sm">{success}</div>}
            <Button type="submit" size="lg" className="w-full">
              Register
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
