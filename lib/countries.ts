// ISO 3166-1 alpha-2 codes, shown with English names (Intl.DisplayNames).
const CODES = "AF AX AL DZ AS AD AO AI AQ AG AR AM AW AU AT AZ BS BH BD BB BY BE BZ BJ BM BT BO BQ BA BW BR IO BN BG BF BI CV KH CM CA KY CF TD CL CN CX CC CO KM CG CD CK CR CI HR CU CW CY CZ DK DJ DM DO EC EG SV GQ ER EE SZ ET FK FO FJ FI FR GF PF GA GM GE DE GH GI GR GL GD GP GU GT GG GN GW GY HT VA HN HK HU IS IN ID IR IQ IE IM IL IT JM JP JE JO KZ KE KI KP KR XK KW KG LA LV LB LS LR LY LI LT LU MO MG MW MY MV ML MT MH MQ MR MU YT MX FM MD MC MN ME MS MA MZ MM NA NR NP NL NC NZ NI NE NG NU NF MK MP NO OM PK PW PS PA PG PY PE PH PN PL PT PR QA RE RO RU RW BL SH KN LC MF PM VC WS SM ST SA SN RS SC SL SG SX SK SI SB SO ZA GS SS ES LK SD SR SJ SE CH SY TW TJ TZ TH TL TG TK TO TT TN TR TM TC TV UG UA AE GB US UM UY UZ VU VE VN VG VI WF EH YE ZM ZW".split(" ");

let names: Intl.DisplayNames | null = null;
export function countryName(code: string) {
  try { names ??= new Intl.DisplayNames(["en"], { type: "region" }); return names.of(code) ?? code; } catch { return code; }
}

export const COUNTRIES = () => CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));
export const isCountry = (c: string) => CODES.includes(c);

// Best guess from the browser: its language region, then its time zone.
export function guessCountry() {
  try {
    const region = new Intl.Locale(navigator.language).maximize().region;
    if (region && CODES.includes(region)) return region;
  } catch { /* old browser */ }
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  if (tz === "Asia/Jerusalem" || tz === "Asia/Tel_Aviv") return "IL";
  if (tz.startsWith("America/")) return "US";
  if (tz === "Europe/London") return "GB";
  return "";
}

// A likely country from a time zone (e.g. the venue's), for zones that clearly belong to one country.
const ZONES: Record<string, string> = {
  "Asia/Jerusalem": "IL", "Asia/Tel_Aviv": "IL", "Europe/London": "GB", "Europe/Dublin": "IE", "Europe/Paris": "FR", "Europe/Berlin": "DE",
  "Europe/Madrid": "ES", "Europe/Rome": "IT", "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Lisbon": "PT", "Europe/Vienna": "AT",
  "Europe/Zurich": "CH", "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI", "Europe/Warsaw": "PL",
  "Europe/Prague": "CZ", "Europe/Athens": "GR", "Europe/Istanbul": "TR", "Europe/Moscow": "RU", "Europe/Kiev": "UA", "Europe/Kyiv": "UA",
  "Europe/Budapest": "HU", "Europe/Bucharest": "RO", "Asia/Dubai": "AE", "Asia/Tokyo": "JP", "Asia/Seoul": "KR", "Asia/Shanghai": "CN",
  "Asia/Hong_Kong": "HK", "Asia/Singapore": "SG", "Asia/Kolkata": "IN", "Asia/Bangkok": "TH", "America/Toronto": "CA", "America/Vancouver": "CA",
  "America/Mexico_City": "MX", "America/Sao_Paulo": "BR", "America/Argentina/Buenos_Aires": "AR", "America/Bogota": "CO", "America/Lima": "PE",
  "America/Santiago": "CL", "Africa/Johannesburg": "ZA", "Africa/Cairo": "EG", "Pacific/Auckland": "NZ",
};
const US = /^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Anchorage|Detroit|Boise|Indiana\/.+|Kentucky\/.+|North_Dakota\/.+)$|^Pacific\/Honolulu$/;
export function countryFromZone(tz: string | null | undefined) {
  if (!tz) return "";
  if (US.test(tz)) return "US";
  if (tz.startsWith("Australia/")) return "AU";
  return ZONES[tz] ?? "";
}

// Menu currency for a country: shekel, euro, pound; dollar for everyone else.
const EURO = "AT BE HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES AD MC SM VA ME XK".split(" ");
export function currencyForCountry(c: string) {
  if (c === "IL" || c === "PS") return "₪";
  if (c === "GB" || c === "GG" || c === "JE" || c === "IM") return "£";
  return EURO.includes(c) ? "€" : "$";
}

export type BillingDetails = { country: string; name: string; tax_id: string; address: string };
