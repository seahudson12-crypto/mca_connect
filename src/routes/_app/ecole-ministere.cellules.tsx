import { createFileRoute } from "@tanstack/react-router";
import { SchoolPage } from "@/components/em/SchoolPage";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_app/ecole-ministere/cellules")({
  head: () =>
    pageHead(
      "Implantation des cellules EM",
      "École du Ministère de la Mission de Christ en Action : implantation des cellules em, suivi pratique et mentorat.",
    ),
  component: Page,
});
function Page() {
  return <SchoolPage view="cellule" />;
}
