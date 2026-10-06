import { ComingSoon, titleFromSlug } from "@/components/shell/ComingSoon";

// Catches every admin nav link that doesn't have a real screen yet
// (All Accounts, Deposits, ...). Delete once each page exists.
export default async function AdminPlaceholderPage({
  params,
}: PageProps<"/admin/[...slug]">) {
  const { slug } = await params;
  return <ComingSoon title={titleFromSlug(slug)} backHref="/admin/dashboard" />;
}
