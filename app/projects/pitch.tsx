"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function PitchProjectPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [skills, setSkills] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const required_skills = skills
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description,
        required_skills,
        owner_id: user.id,
        status: "Open",
      }),
    });
    setLoading(false);
    if (res.ok) {
      router.push("/discover");
    } else {
      alert("Failed to pitch project.");
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-10">
      <Card>
        <CardHeader>
          <h2 className="text-2xl font-bold">Pitch a New Project</h2>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block font-medium mb-1">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Project Title"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                placeholder="Describe your project"
              />
            </div>
            <div>
              <label className="block font-medium mb-1">Required Skills</label>
              <Input
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                required
                placeholder="Comma separated (e.g. React, Node.js, SQL)"
              />
              <div className="flex gap-2 mt-2">
                {skills
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
                  .map((skill) => (
                    <Badge key={skill} variant="outline">
                      {skill}
                    </Badge>
                  ))}
              </div>
            </div>
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Creating..." : "Create Project"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
