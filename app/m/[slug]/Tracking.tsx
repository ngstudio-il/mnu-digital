"use client";
import Script from "next/script";
import { ID_RULES } from "@/lib/marketing";
import type { Marketing } from "@/lib/types";

// The venue's own tracking (Meta Pixel, Google tags, TikTok Pixel), built from the IDs saved in
// Settings → Marketing. Owners can't add raw code, since it would run on mnu.digital itself.
export default function Tracking({ m }: { m: Marketing }) {
  const meta = m.meta_pixel && ID_RULES.meta.test(m.meta_pixel) ? m.meta_pixel : null;
  const google = (m.google_tags ?? []).filter((t) => ID_RULES.google.test(t));
  const gtm = google.filter((t) => t.startsWith("GTM-"));
  const gtag = google.filter((t) => !t.startsWith("GTM-"));
  const tiktok = m.tiktok_pixel && ID_RULES.tiktok.test(m.tiktok_pixel) ? m.tiktok_pixel : null;
  return (
    <>
      {meta && (
        <Script id="mnu-meta" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${meta}');fbq('track','PageView');`}</Script>
      )}
      {gtag.length > 0 && (
        <>
          <Script id="mnu-gtag-src" src={`https://www.googletagmanager.com/gtag/js?id=${gtag[0]}`} strategy="afterInteractive" />
          <Script id="mnu-gtag" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){dataLayer.push(arguments)};window.__mnuGoogle=${JSON.stringify(gtag)};gtag('js',new Date());${gtag.map((t) => `gtag('config','${t}');`).join("")}`}</Script>
        </>
      )}
      {gtm.map((t) => (
        <Script key={t} id={`mnu-gtm-${t}`} strategy="afterInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${t}');`}</Script>
      ))}
      {tiktok && (
        <Script id="mnu-tiktok" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=i,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript",o.async=!0,o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${tiktok}');ttq.page();}(window,document,'ttq');`}</Script>
      )}
    </>
  );
}
