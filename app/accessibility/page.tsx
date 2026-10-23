import type { Metadata } from "next";
import LegalPage, { contactLink, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Accessibility Statement · mnu.digital", description: "MNU Digital LLC's commitment to digital accessibility." };

const SECTIONS: LegalSection[] = [
  { title: "Conformance Status", body: [
    "We aim to adhere as closely as possible to the Web Content Accessibility Guidelines (WCAG) 2.2, Level AA, published by the World Wide Web Consortium (W3C). These guidelines explain how to make digital content more accessible and user-friendly for everyone.",
    "While we strive to improve accessibility across our platform, certain areas, features, or content may not yet be fully optimized for every user or assistive technology. We are aware that some areas of the platform may require improvement and are continually seeking practical solutions.",
  ] },
  { title: "User-Generated and Third-Party Content", body: [
    "Some content made available through our platform may be uploaded, created, or managed by users, including but not limited to menu items, images, documents, PDFs, and translations. As such, we cannot guarantee the accessibility or accuracy of user-generated content.",
    "In addition, certain third-party services or integrations, such as payment processors, embedded tools, or external platforms, may not be fully controlled by MNU and may have their own accessibility limitations.",
  ] },
  { title: "Feedback", body: [
    <>{"We welcome feedback on the accessibility of MNU. If you experience any difficulty accessing any part of our website or platform, or if you have suggestions for improvement, please "}{contactLink}{" and we will make reasonable efforts to assist where possible."}</>,
    "This statement may be updated periodically to reflect changes to our services or accessibility efforts.",
  ] },
];

export default function Accessibility() {
  return <LegalPage title="Accessibility Statement" updated="April 24, 2026" intro={["At MNU Digital LLC (\"MNU\", \"we\", \"our\", or \"us\"), we recognize the importance of digital accessibility and are committed to improving the user experience for all users, regardless of ability.", "We are continually working to improve the accessibility and usability of our website and platform available at https://mnu.digital, and applying relevant accessibility principles and standards where reasonably practicable."]} sections={SECTIONS} />;
}
