import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, CalendarCheck, ClipboardCheck, MessageCircle, Settings, LogOut, Menu, X, Building2, UserCog } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { TEMPLE_FULL_NAME, APP_TAGLINE } from "@/lib/constants";

const NAV = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/membres", label: "Membres", icon: Users },
  { to: "/cultes", label: "Cultes", icon: CalendarCheck },
  { to: "/presences", label: "Présences", icon: ClipboardCheck },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

const ADMIN_NAV = [
  { to: "/temples", label: "Temples", icon: Building2 },
  { to: "/parametres", label: "Paramètres", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, roles, signOut, isAdmin, isSuperAdmin } = useAuth();
  const path = useRouterState({ select: (s) => s.location.pathname });

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = path === item.to || path.startsWith(item.to + "/");
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-gold"
                : "text-sidebar-foreground hover:bg-sidebar-accent"
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
      {isAdmin && (
        <>
          <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase text-sidebar-foreground/60">
            Administration
          </div>
          {ADMIN_NAV.map((item) => {
            const Icon = item.icon;
            const active = path === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </>
      )}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar border-r border-sidebar-border lg:flex">
        <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
          <Logo size={44} />
          <div className="min-w-0">
            <div className="text-sm font-bold text-sidebar-primary">MCA Connect</div>
            <div className="truncate text-xs text-sidebar-foreground/70">{APP_TAGLINE}</div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto"><NavLinks /></div>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2">
            <div className="text-sm font-medium text-sidebar-foreground">{profile?.nom || profile?.email}</div>
            <div className="text-xs text-sidebar-foreground/60">{roles[0] ?? "utilisateur"}</div>
          </div>
          <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-sidebar flex flex-col">
            <div className="flex items-center justify-between gap-3 px-5 py-5 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <Logo size={40} />
                <div className="text-sm font-bold text-sidebar-primary">MCA Connect</div>
              </div>
              <button onClick={() => setOpen(false)} className="text-sidebar-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavLinks /></div>
            <div className="border-t border-sidebar-border p-3">
              <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <LogOut className="mr-2 h-4 w-4" /> Déconnexion
              </Button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/80 backdrop-blur px-4 py-3 lg:px-8">
          <button onClick={() => setOpen(true)} className="lg:hidden text-foreground"><Menu className="h-5 w-5" /></button>
          <Logo size={36} className="lg:hidden" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-foreground lg:text-base">{TEMPLE_FULL_NAME}</div>
            <div className="hidden text-xs text-muted-foreground lg:block">{APP_TAGLINE}</div>
          </div>
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
