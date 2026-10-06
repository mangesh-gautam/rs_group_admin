import type { Metadata } from "next";
import { MandatoryPasswordChange } from "./MandatoryPasswordChange";

export const metadata: Metadata = {
  title: "Update Your Password",
};

export default function ChangePasswordPage() {
  return <MandatoryPasswordChange />;
}
