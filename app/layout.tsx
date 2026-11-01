import type { Metadata, Viewport } from "next";
import SignupConversion from "@/components/marketing/SignupConversion";

export const metadata: Metadata = {
  title: "mnu.digital · Digital menus for restaurants",
  description: "Digital QR menus for restaurants, cafés, bars and hotels. Update dishes and prices from your phone and take orders from the table.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://www.mnu.digital"),
  openGraph: { images: [{ url: "/og", width: 800, height: 800 }], siteName: "mnu.digital", type: "website" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google tag (gtag.js) */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=AW-18530337238" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'AW-18530337238');`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Heebo:wght@400;500;700&family=Noto+Sans+Arabic:wght@400;500;700&display=swap"
        />
      </head>
      <body>{children}<SignupConversion /></body>
    </html>
  );
}
