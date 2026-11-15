import { createFileRoute } from "@tanstack/react-router";
import { SchoolPage } from "@/components/em/SchoolPage";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_app/ecole-ministere/rapports")({
  head: () =>
    pageHead(
      "Rapports et évaluations EM",
      "École du Ministère de la Mission de Christ en Action : rapports et évaluations em, suivi pratique et mentorat.",
    ),
  component: Page,
});
function Page() {
  return <SchoolPage view="rapports" />;
}
