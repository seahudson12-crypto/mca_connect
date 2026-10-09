import { pageHead } from "@/lib/page-head";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { FinanceSuiviModule } from "@/components/finance/FinanceSuiviModule";

export const Route = createFileRoute("/_app/finances/cotisations")({
  head: () => pageHead("Cotisations sociales", "Cotisations sociales : espace MCA CONNECT, Mission de Christ en Action."), component: CotisationsPage });

function CotisationsPage() {
  const { canSeeFinances, loading, defaultRoute } = useAuth();
  if (loading) return null;
  if (!canSeeFinances) return <Navigate to={defaultRoute} />;
  return <FinanceSuiviModule opType="social_contribution" />;
}
