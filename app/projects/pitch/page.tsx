// app/projects/pitch/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function PitchProjectPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [rolesAvailable, setRolesAvailable] = useState("1");
  const [loading, setLoading] = useState(false);

  // Redirect if not authenticated
  if (!user) {
    router.push("/auth");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    if (!description.trim()) {
      toast.error("Please enter a project description");
      return;
    }

    if (!skills.trim()) {
      toast.error("Please enter required skills");
      return;
    }

    setLoading(true);

    // Parse skills into array
    const required_skills = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (required_skills.length === 0) {
      toast.error("Please enter at least one skill");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          required_skills,
          owner_id: user.user_id || parseInt(user.id), // Use user_id or convert id to number
          status: "Open",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Project created successfully!");
        // Reset form
        setTitle("");
        setDescription("");
        setSkills("");
        // Redirect to projects page
        setTimeout(() => {
          router.push("/projects");
        }, 1000);
      } else {
        toast.error(data.error || "Failed to create project");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Back Button */}
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Projects
      </Link>

      <Card>
        <CardHeader>
          <h1 className="text-2xl md:text-3xl font-bold">
            Pitch a New Project
          </h1>
          <p className="text-muted-foreground">
            Share your project idea and find talented collaborators
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <label htmlFor="title" className="block text-sm font-medium">
                Project Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., AI-Powered Task Manager"
                maxLength={100}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                {title.length}/100 characters
              </p>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label
                htmlFor="description"
                className="block text-sm font-medium"
              >
                Description <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your project idea, goals, and what you hope to achieve..."
                rows={6}
                maxLength={1000}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                {description.length}/1000 characters
              </p>
            </div>

            {/* Required Skills */}
            <div className="space-y-2">
              <label htmlFor="skills" className="block text-sm font-medium">
                Required Skills <span className="text-destructive">*</span>
              </label>
              <Input
                id="skills"
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                placeholder="React, Node.js, PostgreSQL, Docker"
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple skills with commas
              </p>

              {/* Skill Tags Preview */}
              {skills.trim() && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {skills
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((skill, index) => (
                      <Badge key={index} variant="outline">
                        {skill}
                      </Badge>
                    ))}
                </div>
              )}
            </div>

            {/* Info Box */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">What happens next?</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Your project will be visible to all developers</li>
                <li>Interested developers can apply to collaborate</li>
                <li>You'll review applications and choose your team</li>
                <li>Start building together!</li>
              </ul>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/projects")}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
