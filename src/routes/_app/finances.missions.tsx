import { pageHead } from "@/lib/page-head";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { FinanceSuiviModule } from "@/components/finance/FinanceSuiviModule";

export const Route = createFileRoute("/_app/finances/missions")({
  head: () => pageHead("Offrandes missionnaires", "Offrandes missionnaires : espace MCA CONNECT, Mission de Christ en Action."), component: MissionsPage });

function MissionsPage() {
  const { canSeeFinances, loading, defaultRoute } = useAuth();
  if (loading) return null;
  if (!canSeeFinances) return <Navigate to={defaultRoute} />;
  return <FinanceSuiviModule opType="mission_offering" />;
}
