import { createFileRoute } from "@tanstack/react-router";
import { SchoolPage } from "@/components/em/SchoolPage";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_app/ecole-ministere/annees")({
  head: () =>
    pageHead(
      "Années académiques EM",
      "École du Ministère de la Mission de Christ en Action : années académiques em, suivi pratique et mentorat.",
    ),
  component: Page,
});
function Page() {
  return <SchoolPage view="annees" />;
}
