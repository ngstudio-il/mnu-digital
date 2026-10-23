import type { Metadata } from "next";
import Link from "next/link";
import LegalPage, { contactLink, type LegalSection } from "@/components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · mnu.digital", description: "The terms that govern the use of MNU Digital LLC's services." };

const contactingUs = <a href="mailto:office@ngstudio.co.il">contacting us here</a>;

const SECTIONS: LegalSection[] = [
  { title: "Eligibility and Authority", body: [
    "You must be at least eighteen (18) years old, or the age of legal majority in your jurisdiction, and have the legal capacity to enter into these Terms. If you are accepting these Terms on behalf of a business or other legal entity, you represent and warrant that you have full authority to bind that entity.",
  ] },
  { title: "Description of Services", body: [
    "MNU provides a software-as-a-service platform that enables businesses to create, manage, publish, and distribute digital menus and related business content. Features may include, without limitation, QR code generation, digital publishing, content management tools, AI-assisted content generation, AI-generated images, automatic translations, file and document uploads, design customization, analytics, integrations, and related tools and services.",
    "We reserve the right to modify, update, suspend, discontinue, or remove any feature, functionality, or part of the Services at any time without liability.",
  ] },
  { title: "Accounts and Registration", body: [
    "In order to access certain features, you may be required to create an account. You agree to provide accurate, complete, and current registration information and to keep such information updated.",
    "You are solely responsible for maintaining the confidentiality of your login credentials and for all activities occurring under your account. You agree to notify us immediately of any unauthorized use or security breach.",
    "We reserve the right to suspend, restrict, or terminate accounts that contain false, misleading, incomplete, or unauthorized information.",
  ] },
  { title: "Subscription Plans, Billing, and Payments", body: [
    "Certain features of the Services may require payment or subscription to a paid plan.",
    "By subscribing to a paid plan, you agree to pay all applicable fees, charges, taxes, and recurring subscription costs associated with your selected plan.",
    "Subscriptions may automatically renew unless canceled prior to the renewal date. By subscribing, you authorize MNU and/or our third-party payment processor to automatically charge your payment method on a recurring basis.",
    "We may attempt to process payments in advance of renewal. If payment fails, we may retry billing and may suspend or terminate access until payment is received.",
    "All fees are stated in U.S. Dollars unless otherwise indicated and are non-cancelable and non-refundable except as required by applicable law or expressly agreed by us in writing.",
    "We reserve the right to modify pricing, plans, features, usage quotas, and billing terms at any time. Any changes may apply prospectively.",
    "Payments may be processed by third-party payment processors such as Stripe, and your use of such services may be subject to their terms and policies.",
  ] },
  { title: "Free Plans, Trials, and Beta Features", body: [
    "We may offer free plans, free trials, promotional plans, or beta / pre-release features from time to time.",
    "Such offerings may include limitations on features, items, storage, AI-generated content, image generation, translations, exports, or other usage.",
    "Beta, trial, and pre-release features are provided on an \"as is\" and \"as available\" basis, may contain bugs or interruptions, and may be modified or discontinued at any time without notice or liability.",
  ] },
  { title: "Taxes", body: [
    "Fees do not include taxes, levies, duties, VAT, GST, sales tax, or similar governmental assessments unless stated otherwise. You are responsible for paying all applicable taxes associated with your use of the Services, excluding taxes based on our income.",
  ] },
  { title: "User Content", body: [
    "Our Services allow you to upload, create, publish, generate, translate, modify, and manage content including text, menu items, prices, descriptions, images, logos, PDFs, documents, and other materials (\"User Content\").",
    "You retain ownership of your User Content. However, by uploading or publishing User Content, you grant MNU a worldwide, non-exclusive, royalty-free, sublicensable license to host, store, reproduce, modify, translate, process, display, distribute, publish, and otherwise use such User Content solely for the purpose of operating, improving, marketing, and providing the Services.",
    "You represent and warrant that you own or have all necessary rights and permissions to use and publish your User Content and that it does not violate any law or infringe any third-party rights.",
    "We may monitor content but are under no obligation to do so. We reserve the right to remove or disable access to any content at our discretion, with or without notice.",
    "You acknowledge and agree that you are solely deemed the publisher of any publicly displayed or distributed content created, uploaded, or made available through the Services.",
  ] },
  { title: "AI-Generated Content and Translations", body: [
    "The Services may provide AI-generated content, AI-generated images, automated translations, design suggestions, or other automated outputs.",
    "Such outputs may contain inaccuracies, omissions, offensive material, errors, or content that may infringe third-party rights, and may not be unique.",
    "You are solely responsible for reviewing, verifying, editing, approving, and complying with any laws applicable to your use of AI-generated outputs before publishing or relying on them.",
    "MNU does not review, approve, endorse, or guarantee the legality, accuracy, quality, suitability, or non-infringement of AI-generated outputs.",
    "MNU disclaims all liability arising from AI-generated outputs and automated translations, including without limitation errors relating to allergens, ingredients, nutritional information, legal compliance, or intellectual property rights.",
  ] },
  { title: "Prohibited Uses", body: [
    "You agree not to use the Services to:",
    {"list": ["violate any applicable law or regulation;", "infringe intellectual property, privacy, publicity, or other rights;", "upload malware, viruses, or harmful code;", "gain unauthorized access to accounts, systems, or networks;", "scrape, copy, reverse engineer, or exploit the Services;", "interfere with the operation or security of the Services;", "engage in fraudulent, deceptive, or unlawful conduct;", "upload unlawful, offensive, misleading, or infringing content."]},
  ] },
  { title: "Intellectual Property Complaints", body: [
    <>If you believe that any content available through the Services infringes your copyright, trademark, trade dress, logo, brand name, or other intellectual property rights, please notify us promptly by {contactingUs} with sufficient details to identify the allegedly infringing material.</>,
    "We reserve the right to investigate such claims and to remove or disable access to allegedly infringing content at our sole discretion, with or without prior notice.",
    "We may suspend or terminate accounts of repeat intellectual property infringers.",
  ] },
  { title: "Third-Party Services and Integrations", body: [
    "The Services may integrate with or rely upon third-party services, software, platforms, or tools including payment processors, analytics providers, Google services, AI providers, cloud storage providers, and external APIs.",
    "We do not control and are not responsible for any third-party services, content, availability, security, or policies.",
    "Your use of third-party services may be subject to separate third-party terms.",
  ] },
  { title: "Intellectual Property", body: [
    "All rights, title, and interest in and to the Services, including software, code, designs, trademarks, logos, text, graphics, documentation, and technology, excluding User Content, are owned by or licensed to MNU and protected by intellectual property laws.",
    "Except as expressly permitted, you may not copy, modify, distribute, sell, sublicense, lease, or create derivative works based on the Services.",
  ] },
  { title: "Availability; Backups; Disclaimer of Warranties", body: [
    "The Services are provided on an \"as is,\" \"as available,\" and \"with all faults\" basis.",
    "We do not guarantee uninterrupted availability, uptime, security, compatibility, or error-free operation.",
    "You are solely responsible for maintaining independent backups of your content, files, menus, and business data.",
    "To the fullest extent permitted by law, we disclaim all warranties, express or implied, including merchantability, fitness for a particular purpose, non-infringement, and any warranties arising from course of dealing or usage of trade.",
  ] },
  { title: "Limitation of Liability", body: [
    "To the fullest extent permitted by law, MNU and its officers, directors, employees, affiliates, licensors, contractors, and service providers shall not be liable for any indirect, incidental, consequential, special, punitive, or exemplary damages, including loss of profits, loss of revenue, loss of goodwill, business interruption, loss of data, reputational harm, or claims arising from user-generated or AI-generated content.",
    "Our total aggregate liability for any claim arising out of or relating to the Services or these Terms shall not exceed the greater of:",
    {"list": ["(a) the total fees paid by you to MNU during the twelve (12) months preceding the claim; or", "(b) one hundred U.S. dollars (US$100)."]},
  ] },
  { title: "Indemnification", body: [
    "You agree to defend, indemnify, and hold harmless MNU and its affiliates, officers, directors, employees, contractors, licensors, and service providers from and against any claims, liabilities, damages, losses, costs, and expenses, including reasonable attorneys' fees, arising out of or related to:",
    {"list": ["your use of the Services;", "your User Content;", "your AI-generated outputs;", "your violation of these Terms;", "your violation of any law or third-party rights."]},
  ] },
  { title: "Suspension and Termination", body: [
    "We may suspend, restrict, or terminate your access to the Services immediately, with or without notice, for non-payment, violation of these Terms, suspected abuse, legal compliance, security concerns, or any other reason at our discretion.",
    "You may stop using the Services at any time. Cancellation or termination does not relieve you of payment obligations already accrued.",
    "We may delete or retain your data in accordance with our retention policies following termination.",
  ] },
  { title: "Force Majeure", body: [
    "MNU shall not be liable for delays or failure in performance resulting from causes beyond our reasonable control, including acts of God, war, terrorism, cyberattacks, labor disputes, internet outages, third-party failures, governmental actions, or natural disasters.",
  ] },
  { title: "Arbitration; Class Action Waiver", body: [
    "To the fullest extent permitted by law, any dispute arising out of or relating to these Terms or the Services shall be resolved on an individual basis and not as part of any class, collective, or representative action.",
    "We may elect to resolve disputes through binding arbitration in a jurisdiction determined by us, except where prohibited by law.",
    "You waive any right to participate in class actions or jury trials to the extent permitted by law.",
  ] },
  { title: "Governing Law and Jurisdiction", body: [
    "These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to conflict of law principles.",
    "Any disputes not subject to arbitration shall be subject to the exclusive jurisdiction of the courts located in Delaware.",
  ] },
  { title: "Changes to These Terms", body: [
    "We may update or modify these Terms at any time. Changes become effective upon posting the updated Terms.",
    "Your continued use of the Services after changes are posted constitutes acceptance of the revised Terms.",
  ] },
  { title: "Miscellaneous", body: [
    "These Terms constitute the entire agreement between you and MNU regarding the Services and supersede prior agreements or understandings.",
    "If any provision is found unenforceable, the remaining provisions shall remain in full force and effect.",
    "Our failure to enforce any provision shall not constitute a waiver.",
    "We may assign these Terms without restriction. You may not assign these Terms without our prior written consent.",
  ] },
  { title: "Contact Us", body: [
    <>If you have any questions regarding these Terms, please {contactLink}.</>,
  ] },
];

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="April 24, 2026"
      intro={[
        "Welcome to MNU Digital LLC (\"MNU\", \"Company\", \"we\", \"our\", or \"us\"). These Terms of Service (\"Terms\") constitute a legally binding agreement between you (\"Customer\", \"you\", or \"your\") and MNU Digital LLC and govern your access to and use of our website, platform, applications, software, and related services available through https://mnu.digital and any related domains, subdomains, applications, and services (collectively, the \"Services\").",
        <>By accessing, registering for, or using the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms and our <Link href="/privacy">Privacy Policy</Link>, <Link href="/accessibility">Accessibility Statement</Link>, and any additional policies or guidelines we may publish from time to time. If you do not agree, you may not use the Services.</>,
      ]}
      sections={SECTIONS}
    />
  );
}
