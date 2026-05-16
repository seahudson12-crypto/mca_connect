import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/Logo";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({ component: ForgotPasswordPage });

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    setSent(true);
    toast.success("Email envoyé");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md p-8 shadow-elegant border-0">
        <div className="flex items-center gap-3 mb-6">
          <Logo size={48} />
          <div className="text-lg font-bold">MCA Connect</div>
        </div>
        <h2 className="text-2xl font-bold">Mot de passe oublié</h2>
        <p className="mt-1 text-sm text-muted-foreground">Recevez un lien de réinitialisation par email</p>
        {sent ? (
          <p className="mt-6 text-sm text-foreground">
            Si un compte existe pour <b>{email}</b>, un email contenant un lien de réinitialisation a été envoyé.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="w-full gradient-brand text-primary-foreground border-0">
              {loading ? "Envoi..." : "Envoyer le lien"}
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-sm">
          <Link to="/login" className="text-primary hover:underline">Retour à la connexion</Link>
        </p>
      </Card>
    </div>
  );
}
