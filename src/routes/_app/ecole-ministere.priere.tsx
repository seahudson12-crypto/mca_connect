import { createFileRoute } from "@tanstack/react-router";
import { SchoolPage } from "@/components/em/SchoolPage";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_app/ecole-ministere/priere")({
  head: () =>
    pageHead(
      "Vie de prière collective EM",
      "École du Ministère de la Mission de Christ en Action : vie de prière collective em, suivi pratique et mentorat.",
    ),
  component: Page,
});
function Page() {
  return <SchoolPage view="priere" />;
}
