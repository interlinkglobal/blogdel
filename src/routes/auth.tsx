import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

const searchSchema = z.object({ next: z.string().optional() });
export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({ meta: [{ title: "Sign in — Blogdel" }, { name: "robots", content: "noindex,nofollow,noarchive" }] }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) nav({ to: next && next.startsWith("/") ? next as any : "/admin" });
    });
  }, [nav, next]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Signed in");
    nav({ to: next && next.startsWith("/") ? next as any : "/admin" });
  };
  const google = async () => {
    setBusy(true);
    const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (res.error) return toast.error(res.error.message ?? String(res.error));
    if (res.redirected) return;
    nav({ to: next && next.startsWith("/") ? next as any : "/admin" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link to="/" className="headline text-4xl">Blogdel</Link>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground mt-1">Newsroom access</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Staff sign in</CardTitle>
            <CardDescription>Authorized newsroom access only.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup" disabled title="Account creation is disabled. Ask a Blogdel administrator for access.">Create account</TabsTrigger>
              </TabsList>
            </Tabs>
            <form onSubmit={signIn} className="space-y-3 mt-3">
              <div><Label>Email</Label><Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <div><Label>Password</Label><Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
              <Button className="w-full" disabled={busy} type="submit">Sign in</Button>
            </form>
            <div className="my-4 flex items-center gap-2"><div className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground uppercase tracking-widest">or</span><div className="h-px flex-1 bg-border" /></div>
            <Button variant="outline" className="w-full" disabled={busy} onClick={google}>Continue with Google</Button>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4"><Link to="/" className="underline">← Back to the publication</Link></p>
      </div>
    </div>
  );
}
