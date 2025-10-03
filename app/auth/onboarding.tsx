"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OnboardingPage() {
  const [bio, setBio] = useState("");
  const [skills, setSkills] = useState("");
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccess("");
    // Basic validation
    if (!bio.trim() || !skills.trim() || !github.trim() || !linkedin.trim()) {
      setError("All fields are required.");
      return;
    }
    setError("");
    // Call backend API to save onboarding info
    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bio, skills, github, linkedin }),
      });
      if (res.ok) {
        setSuccess("Onboarding complete! Redirecting...");
        setTimeout(() => router.push("/projects"), 1500);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to save onboarding info.");
      }
    } catch (err) {
      setError("Server error. Please try again later.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20">
      <Card className="w-full max-w-md">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-center">
            Complete Your Profile
          </h1>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <textarea
              placeholder="Short Bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="border rounded px-4 py-2 focus:outline-none focus:ring focus:border-primary"
              rows={3}
            />
            <input
              type="text"
              placeholder="Skills (comma separated)"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="border rounded px-4 py-2 focus:outline-none focus:ring focus:border-primary"
            />
            <input
              type="url"
              placeholder="GitHub URL"
              value={github}
              onChange={(e) => setGithub(e.target.value)}
              className="border rounded px-4 py-2 focus:outline-none focus:ring focus:border-primary"
            />
            <input
              type="url"
              placeholder="LinkedIn URL"
              value={linkedin}
              onChange={(e) => setLinkedin(e.target.value)}
              className="border rounded px-4 py-2 focus:outline-none focus:ring focus:border-primary"
            />
            {error && <div className="text-red-500 text-sm">{error}</div>}
            {success && <div className="text-green-500 text-sm">{success}</div>}
            <Button type="submit" size="lg" className="w-full">
              Finish Onboarding
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
