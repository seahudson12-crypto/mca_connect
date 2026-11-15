import { createFileRoute } from "@tanstack/react-router";
import { SchoolPage } from "@/components/em/SchoolPage";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_app/ecole-ministere/etudiants")({
  head: () =>
    pageHead(
      "Étudiants EM",
      "École du Ministère de la Mission de Christ en Action : étudiants em, suivi pratique et mentorat.",
    ),
  component: Page,
});
function Page() {
  return <SchoolPage view="etudiants" />;
}
