"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthStore } from "@/store/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { X } from "lucide-react";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuthStore();

  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [skillInput, setSkillInput] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [github, setGithub] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const emailParam = searchParams?.get("email");
    if (emailParam) {
      setEmail(emailParam);
    } else {
      // If no email in query, redirect to register
      router.push("/auth/register");
    }
  }, [searchParams, router]);

  const handleAddSkill = () => {
    const trimmedSkill = skillInput.trim();
    if (trimmedSkill && !skills.includes(trimmedSkill)) {
      setSkills([...skills, trimmedSkill]);
      setSkillInput("");
    }
  };

  const handleRemoveSkill = (skillToRemove: string) => {
    setSkills(skills.filter((skill) => skill !== skillToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSkill();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!bio.trim()) {
      toast.error("Please enter a short bio");
      return;
    }

    if (skills.length === 0) {
      toast.error("Please add at least one skill");
      return;
    }

    if (!github.trim() || !linkedin.trim()) {
      toast.error("Please enter both GitHub and LinkedIn URLs");
      return;
    }

    // Basic URL validation
    const urlRegex = /^https?:\/\/.+/;
    if (!urlRegex.test(github)) {
      toast.error(
        "Please enter a valid GitHub URL (starting with http:// or https://)"
      );
      return;
    }

    if (!urlRegex.test(linkedin)) {
      toast.error(
        "Please enter a valid LinkedIn URL (starting with http:// or https://)"
      );
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          bio: bio.trim(),
          skills,
          github: github.trim(),
          linkedin: linkedin.trim(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Profile completed! Welcome to Konverge 🎉");

        // Set user in auth store
        setUser(data.user);

        // Redirect to projects page
        setTimeout(() => {
          router.push("/projects");
        }, 1000);
      } else {
        toast.error(data.error || "Failed to complete onboarding");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      toast.error("Server error. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted/20 p-4">
      <Card className="w-full max-w-2xl">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Complete Your Profile
            </h1>
            <p className="text-muted-foreground">
              Help others know more about you and your skills
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Bio */}
            <div className="space-y-2">
              <label htmlFor="bio" className="block text-sm font-medium">
                Bio <span className="text-destructive">*</span>
              </label>
              <Textarea
                id="bio"
                placeholder="Tell us about yourself, your experience, and what you're passionate about..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={4}
                maxLength={500}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                {bio.length}/500 characters
              </p>
            </div>

            {/* Skills */}
            <div className="space-y-2">
              <label htmlFor="skills" className="block text-sm font-medium">
                Skills <span className="text-destructive">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  id="skills"
                  placeholder="e.g., React, Python, Node.js"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={loading}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAddSkill}
                  disabled={loading || !skillInput.trim()}
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Press Enter or click Add to add skills
              </p>

              {/* Skills Display */}
              {skills.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {skills.map((skill) => (
                    <Badge
                      key={skill}
                      variant="secondary"
                      className="gap-1 pr-1"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => handleRemoveSkill(skill)}
                        className="ml-1 rounded-full hover:bg-muted p-0.5"
                        disabled={loading}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* GitHub */}
            <div className="space-y-2">
              <label htmlFor="github" className="block text-sm font-medium">
                GitHub Profile <span className="text-destructive">*</span>
              </label>
              <Input
                id="github"
                type="url"
                placeholder="https://github.com/yourusername"
                value={github}
                onChange={(e) => setGithub(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* LinkedIn */}
            <div className="space-y-2">
              <label htmlFor="linkedin" className="block text-sm font-medium">
                LinkedIn Profile <span className="text-destructive">*</span>
              </label>
              <Input
                id="linkedin"
                type="url"
                placeholder="https://linkedin.com/in/yourusername"
                value={linkedin}
                onChange={(e) => setLinkedin(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Info Box */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium">
                Why we need this information:
              </p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>
                  Your bio helps project owners understand your background
                </li>
                <li>Skills are used to match you with relevant projects</li>
                <li>Social profiles help build trust in the community</li>
              </ul>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Setting up your profile..." : "Complete Profile"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
