import { ComingSoon, titleFromSlug } from "@/components/shell/ComingSoon";

// Placeholder for super-admin nav items without a real screen yet (Settings).
export default async function SuperAdminPlaceholderPage({
  params,
}: PageProps<"/super-admin/[...slug]">) {
  const { slug } = await params;
  return (
    <ComingSoon
      title={titleFromSlug(slug)}
      backHref="/super-admin/create-employee-login"
    />
  );
}
