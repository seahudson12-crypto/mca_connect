import { createFileRoute } from "@tanstack/react-router";
import { SchoolPage } from "@/components/em/SchoolPage";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_app/ecole-ministere/tours-garde")({
  head: () =>
    pageHead(
      "Tours de garde EM",
      "École du Ministère de la Mission de Christ en Action : tours de garde em, suivi pratique et mentorat.",
    ),
  component: Page,
});
function Page() {
  return <SchoolPage view="garde" />;
}
