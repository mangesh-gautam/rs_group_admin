import type { Metadata } from "next";
import { Suspense } from "react";
import { FullPageLoader } from "@/components/auth/RequireAuth";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Login",
};

export default function LoginPage() {
  return (
    // useSearchParams (?next=, ?reason=) needs a Suspense boundary.
    <Suspense fallback={<FullPageLoader label="Loading…" />}>
      <LoginForm />
    </Suspense>
  );
}
