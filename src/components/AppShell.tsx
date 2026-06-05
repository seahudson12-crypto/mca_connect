import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, Users, CalendarCheck, ClipboardCheck, MessageCircle, Settings, LogOut, Menu, X, Building2, UserCog, Wallet, History, Activity, ShieldCheck, ArrowLeftRight, FileText, Download, Target, GraduationCap, BookOpen, Bell, Users2, CalendarDays } from "lucide-react";
import { useState } from "react";
import { Logo } from "./Logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useActiveTemple } from "@/hooks/use-active-temple";
import { APP_TAGLINE, roleLabel } from "@/lib/constants";

const NAV = [
  { to: "/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
  { to: "/membres", label: "Membres", icon: Users },
  { to: "/cultes", label: "Cultes", icon: CalendarCheck },
  { to: "/presences", label: "Présences", icon: ClipboardCheck },
  { to: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const { profile, role, signOut, isAdmin, isSuperAdmin, isPrincipal, canSeeFinances } = useAuth();
  const { activeTemple, allTemples, setActiveTempleId, canSwitch } = useActiveTemple();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const templeDisplay = activeTemple?.nom_temple ?? "MCA Connect";

  const linkCls = (active: boolean) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      active ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-gold" : "text-sidebar-foreground hover:bg-sidebar-accent"
    }`;

  const NavLinks = () => (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const Icon = item.icon;
        const active = path === item.to || path.startsWith(item.to + "/");
        return (
          <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={linkCls(active)}>
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}

      {canSeeFinances && (
        <Link to="/finances" onClick={() => setOpen(false)} className={linkCls(path === "/finances")}>
          <Wallet className="h-4 w-4" /> Finances
        </Link>
      )}

      <Link to="/familles" onClick={() => setOpen(false)} className={linkCls(path === "/familles")}>
        <Users2 className="h-4 w-4" /> Familles
      </Link>

      <Link to="/calendrier" onClick={() => setOpen(false)} className={linkCls(path === "/calendrier")}>
        <CalendarDays className="h-4 w-4" /> Calendrier MCA
      </Link>

      <Link to="/objectifs" onClick={() => setOpen(false)} className={linkCls(path === "/objectifs")}>
        <Target className="h-4 w-4" /> Objectifs
      </Link>

      <Link to="/formations" onClick={() => setOpen(false)} className={linkCls(path === "/formations")}>
        <GraduationCap className="h-4 w-4" /> Formation & Discipulat
      </Link>

      <Link to="/themes-annee" onClick={() => setOpen(false)} className={linkCls(path === "/themes-annee")}>
        <BookOpen className="h-4 w-4" /> Thème de l'année
      </Link>





      {isAdmin && (
        <>
          <div className="mt-4 mb-1 px-3 text-xs font-semibold uppercase text-sidebar-foreground/60">
            Administration
          </div>
          <Link to="/historique" onClick={() => setOpen(false)} className={linkCls(path === "/historique")}>
            <History className="h-4 w-4" /> Historique
          </Link>
          <Link to="/activites" onClick={() => setOpen(false)} className={linkCls(path === "/activites")}>
            <Activity className="h-4 w-4" /> Activités
          </Link>
          <Link to="/alertes" onClick={() => setOpen(false)} className={linkCls(path === "/alertes")}>
            <Bell className="h-4 w-4" /> Alertes
          </Link>
          <Link to="/exports" onClick={() => setOpen(false)} className={linkCls(path === "/exports")}>
            <Download className="h-4 w-4" /> Exports avancés
          </Link>
          {isSuperAdmin && (
            <>
              <Link to="/rapports" onClick={() => setOpen(false)} className={linkCls(path === "/rapports")}>
                <FileText className="h-4 w-4" /> Rapports des temples
              </Link>
              <Link to="/temples" onClick={() => setOpen(false)} className={linkCls(path === "/temples")}>
                <Building2 className="h-4 w-4" /> Temples
              </Link>
              <Link to="/utilisateurs" onClick={() => setOpen(false)} className={linkCls(path === "/utilisateurs")}>
                <UserCog className="h-4 w-4" /> Équipe de gestion
              </Link>
            </>
          )}
          <Link to="/parametres" onClick={() => setOpen(false)} className={linkCls(path === "/parametres")}>
            <Settings className="h-4 w-4" /> Paramètres
          </Link>
        </>
      )}
    </nav>
  );

  const RoleBadge = () => (
    <Badge className={
      isPrincipal ? "bg-gold text-foreground"
      : isSuperAdmin ? "bg-primary text-primary-foreground"
      : role === "admin_temple" ? "bg-accent text-accent-foreground"
      : "bg-muted text-muted-foreground"
    }>
      {isPrincipal && <ShieldCheck className="h-3 w-3 mr-1" />}
      {roleLabel(role)}
    </Badge>
  );

  return (
    <div className="min-h-screen bg-background">
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
            <div className="text-sm font-medium text-sidebar-foreground truncate">{profile?.nom || profile?.email}</div>
            <div className="mt-1"><RoleBadge /></div>
          </div>
          <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <LogOut className="mr-2 h-4 w-4" /> Déconnexion
          </Button>
        </div>
      </aside>

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
              <div className="mb-2 px-2"><RoleBadge /></div>
              <Button onClick={signOut} variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground">
                <LogOut className="mr-2 h-4 w-4" /> Déconnexion
              </Button>
            </div>
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-card/80 backdrop-blur px-4 py-3 lg:px-8">
          <button onClick={() => setOpen(true)} className="lg:hidden text-foreground"><Menu className="h-5 w-5" /></button>
          <Logo size={36} className="lg:hidden" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 shrink-0 text-primary" />
              <div className="truncate text-sm font-semibold text-foreground lg:text-base">{templeDisplay}</div>
            </div>
            <div className="hidden text-xs text-muted-foreground lg:block">{APP_TAGLINE}</div>
          </div>
          {canSwitch && allTemples.length > 1 && (
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="hidden sm:block h-4 w-4 text-muted-foreground" />
              <Select value={activeTemple?.id ?? ""} onValueChange={setActiveTempleId}>
                <SelectTrigger className="w-[180px] sm:w-[240px] h-9 text-xs">
                  <SelectValue placeholder="Switch temple" />
                </SelectTrigger>
                <SelectContent>
                  {allTemples.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-xs">
                      {t.nom_temple}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </header>
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
