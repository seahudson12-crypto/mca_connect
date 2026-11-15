import { createFileRoute } from "@tanstack/react-router";
import { SchoolPage } from "@/components/em/SchoolPage";
import { pageHead } from "@/lib/page-head";
export const Route = createFileRoute("/_app/ecole-ministere/classes")({
  head: () =>
    pageHead(
      "Classes EM",
      "École du Ministère de la Mission de Christ en Action : classes em, suivi pratique et mentorat.",
    ),
  component: Page,
});
function Page() {
  return <SchoolPage view="classes" />;
}
