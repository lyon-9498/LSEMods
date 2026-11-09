import { CatalogueClient } from "@/components/CatalogueClient";
import { getIndex, getMeta } from "@/lib/data";

export const metadata = {
  title: "Courses",
};

export default async function CoursesPage() {
  const [index, meta] = await Promise.all([getIndex(), getMeta().catch(() => null)]);
  return <CatalogueClient index={index} meta={meta} />;
}
