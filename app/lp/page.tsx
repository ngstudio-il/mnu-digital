import type { Metadata } from "next";
import TryIt from "./TryIt";

export const metadata: Metadata = {
  title: "See your menu as a digital menu · mnu.digital",
  description: "Upload a photo or PDF of your menu, or paste it, and see it as a digital QR menu in under a minute. Free.",
};

export default function LandingTry() {
  return <TryIt />;
}
