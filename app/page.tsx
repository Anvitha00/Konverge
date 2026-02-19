"use client";

import Link from "next/link";
import { ArrowRight, Users, Zap, Trophy, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuthStore } from "@/store/auth-store";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

const features = [
  {
    icon: Users,
    title: "Smart Matching",
    description:
      "AI-powered algorithm matches you with perfect collaborators based on skills, availability, and project fit.",
  },
  {
    icon: Zap,
    title: "Real-time Collaboration",
    description:
      "Built-in chat, project management tools, and real-time updates keep your team synchronized.",
  },
  {
    icon: Trophy,
    title: "Gamified Experience",
    description:
      "Earn badges, climb leaderboards, and build your reputation in the developer community.",
  },
  {
    icon: MessageCircle,
    title: "Seamless Communication",
    description:
      "Project-based chat rooms and direct messaging make collaboration effortless.",
  },
];

export default function Home() {
  const { isAuthenticated } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/auth");
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="container mx-auto flex items-center justify-between px-4 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
            K
          </div>
          <span className="text-xl font-bold">onverge</span>
        </div>
        <nav className="hidden md:flex items-center gap-6">
          <Link
            href="/auth"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign In
          </Link>
          <Button asChild>
            <Link href="/auth">Get Started</Link>
          </Button>
        </nav>
      </header>

      <main className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="py-20 text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">
            Where Skills and Ideas
            <span className="text-primary"> Converge</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Join the platform where passionate developers pitch ideas, find
            perfect collaborators, and build amazing projects together. Turn
            your vision into reality.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href="/auth">
                Start Collaborating
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="text-lg px-8"
              asChild
            >
              <Link href="/projects">Browse Projects</Link>
            </Button>
          </div>

        </div>

        {/* Features */}
        <div className="py-20">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Built for Modern Collaboration
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to find, connect, and collaborate with
              developers who share your passion.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <Card
                key={feature.title}
                className="group hover:shadow-lg transition-all duration-300"
              >
                <CardContent className="p-6">
                  <feature.icon className="h-12 w-12 text-primary mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-lg font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="py-20 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Build Something Amazing?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Join thousands of developers who are already collaborating and
              building the future together.
            </p>
            <Button size="lg" className="text-lg px-8" asChild>
              <Link href="/auth">
                Join Konverge Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="border-t py-12">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>
            &copy; 2025 Konverge. Built with passion by developers, for
            developers.
          </p>
        </div>
      </footer>
    </div>
  );
}
