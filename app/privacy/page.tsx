import type { Metadata } from "next";
import LegalPage, { contactLink, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · mnu.digital", description: "How MNU Digital LLC collects, uses and protects information." };

const SECTIONS: LegalSection[] = [
  { title: "Information We Collect", body: [
    "We may collect information that you provide directly to us when you register for an account, subscribe to a plan, communicate with us, request support, or otherwise use our Services. This information may include your full name, business or restaurant name, email address, phone number, login credentials, billing and subscription details, business address, and any content, materials, or communications you submit through the platform.",
    "Because MNU is a digital menu and business management platform, we may also collect and process content that you upload, create, or manage through the Services, including menu items, descriptions, prices, categories, translations, images, logos, PDFs, documents, and other user-generated materials.",
    "In addition, when you access or use our Services, we may automatically collect certain technical and usage-related information, including your IP address, browser type and version, device type, operating system, language preferences, referring URLs, pages visited, actions taken, date and time of access, session duration, and interaction data. We may collect this information using cookies, pixels, local storage, and similar tracking technologies.",
    "We may also receive information from third parties, such as payment processors, authentication providers including Google OAuth, analytics providers, advertising and marketing platforms, integration partners, cloud storage providers, and publicly available business directories or professional networks where permitted by law.",
  ] },
  { title: "Legal Basis for Processing", body: [
    "Where required under applicable law, including the General Data Protection Regulation (GDPR), we process personal information under one or more lawful bases, including where processing is necessary for the performance of a contract, to take steps prior to entering into a contract, to comply with legal obligations, for our legitimate business interests, or based on your consent where required.",
  ] },
  { title: "How We Use Information", body: [
    "We use the information we collect to operate, maintain, improve, personalize, and secure our Services. This includes creating and managing user accounts, processing subscriptions and transactions, providing customer support, generating QR codes, publishing digital menus, enabling AI-powered features such as content generation, image generation, translations, and design suggestions, monitoring usage and performance, generating anonymized or aggregated analytics and usage insights, improving our marketing efforts, developing new products and features, and complying with legal obligations.",
    "We may also use your information to communicate with you regarding service updates, invoices, technical notices, security alerts, support messages, and marketing communications where permitted by law.",
  ] },
  { title: "Payments", body: [
    "If you purchase a subscription or make a payment through our Services, payment processing may be handled by third-party payment providers such as Stripe. We do not store full payment card numbers or sensitive payment credentials on our servers. Payment-related information is processed directly by the applicable payment processor in accordance with their own privacy policies and security standards.",
  ] },
  { title: "User-Generated Content", body: [
    "Our Services allow users to upload, create, publish, and manage content. You are solely responsible for the legality, ownership, accuracy, and compliance of any content you upload or publish through the Services. We may process, store, reproduce, display, and distribute such content solely for the purpose of providing and improving the Services.",
  ] },
  { title: "Cookies and Tracking Technologies", body: [
    "We use cookies and similar technologies to improve functionality, remember user preferences, keep users logged in, analyze traffic and usage patterns, measure the effectiveness of marketing campaigns, personalize advertising, and improve the performance of the Services.",
    "We may also use third-party tools such as Google Analytics, Google Tag Manager, Meta Pixel, or similar technologies for analytics and advertising purposes. You may disable cookies through your browser settings, though some features of the Services may not function properly.",
  ] },
  { title: "AI Features and Automated Processing", body: [
    "Certain features of our Services may use artificial intelligence or automated systems to generate or process content, including menu descriptions, images, graphics, translations, and design suggestions. While we strive to provide useful outputs, AI-generated content may not always be accurate, complete, or suitable for every purpose. Users remain responsible for reviewing and approving generated content before publishing or relying on it.",
  ] },
  { title: "Google Services and APIs", body: [
    "Where our Services integrate with Google APIs, Google OAuth, Google Drive, Google Picker, or related Google services, the use and transfer of information received from Google APIs will comply with applicable Google API Services User Data Policy, including Limited Use requirements where applicable.",
  ] },
  { title: "Sharing of Information", body: [
    "We may share information with trusted third-party service providers, contractors, payment processors, cloud hosting providers, storage providers, analytics providers, advertising and marketing providers, authentication providers, subsidiaries, affiliates, auditors, consultants, professional advisers, investors, lenders, and legal authorities where required.",
    "We may also disclose or transfer information in connection with a merger, acquisition, financing transaction, corporate restructuring, or sale of all or part of our business or assets.",
    "We do not sell personal information.",
  ] },
  { title: "Data Retention", body: [
    "We retain information for as long as reasonably necessary to provide the Services, comply with legal obligations, resolve disputes, enforce agreements, maintain backups, and preserve records. Certain information may be retained after account termination where legally permitted or required.",
  ] },
  { title: "Data Security", body: [
    "We implement commercially reasonable administrative, technical, and organizational measures designed to protect information from loss, misuse, unauthorized access, disclosure, alteration, or destruction. However, no system can be guaranteed to be completely secure, and we cannot guarantee absolute security.",
  ] },
  { title: "International Data Transfers", body: [
    "Because we operate globally, your information may be processed, stored, or transferred to countries outside your jurisdiction, including the United States and other countries where our service providers operate. By using the Services, you consent to such transfers where permitted by law.",
  ] },
  { title: "Your Privacy Rights", body: [
    "Depending on your jurisdiction, you may have rights regarding your personal information, including the right to access, correct, delete, restrict, or object to certain processing activities, withdraw consent where applicable, request portability of your data, and object to direct marketing communications.",
    "If you are located in the European Economic Area (EEA), the United Kingdom, or another jurisdiction with applicable privacy laws, you may also have the right to lodge a complaint with your local data protection authority. To exercise your rights, please contact us using the details below.",
  ] },
  { title: "Children's Privacy", body: [
    "Our Services are not intended for children under the age of 13, and we do not knowingly collect personal information from children.",
  ] },
  { title: "Third-Party Services and Customer Compliance", body: [
    "Our Services may contain links to or integrations with third-party services or platforms. We are not responsible for the privacy practices, policies, or content of such third parties.",
    "Customers using our platform to collect, process, or manage information relating to their own customers, visitors, or users are solely responsible for ensuring their own compliance with applicable privacy and data protection laws.",
  ] },
  { title: "Legal Compliance and Enforcement", body: [
    "We may disclose information where necessary to comply with applicable law, legal process, governmental request, or to protect our rights, property, safety, users, or to enforce our agreements and policies.",
  ] },
  { title: "Changes to This Privacy Policy", body: [
    "We may update this Privacy Policy from time to time. Any changes will become effective upon posting the updated version on our website, together with the updated \"Last Updated\" date.",
  ] },
  { title: "Contact Us", body: [
    <>{"If you have any questions about this Privacy Policy or our privacy practices, please "}{contactLink}{"."}</>,
  ] },
];

export default function Privacy() {
  return <LegalPage title="Privacy Policy" updated="April 24, 2026" intro={["Welcome to MNU Digital LLC (\"MNU\", \"we\", \"our\", or \"us\"). This Privacy Policy describes how we collect, use, process, disclose, and protect information when you access or use our website, platform, and related services available through https://mnu.digital and any related domains, subdomains, applications, or services (collectively, the \"Services\"). By accessing or using our Services, you acknowledge and agree to the practices described in this Privacy Policy."]} sections={SECTIONS} />;
}
