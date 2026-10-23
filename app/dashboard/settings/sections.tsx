export const SETTINGS_SECTIONS = [
  {
    href: "/dashboard/settings/general", label: "General",
    desc: "Venue details, menu link, ordering options, plan and account.",
    icon: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></>,
  },
  {
    href: "/dashboard/settings/design", label: "Design",
    desc: "Cover photo, logo, style, fonts and colours, with a live guest view.",
    icon: <><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.6 0-1.3-1-1.6-1-2.6 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5C21 6.3 17 3 12 3z" /><circle cx="7.5" cy="11" r="1.2" /><circle cx="10.5" cy="7.2" r="1.2" /><circle cx="15" cy="7.5" r="1.2" /></>,
  },
  {
    href: "/dashboard/settings/languages", label: "Languages",
    desc: "Your menu’s main language and automatic AI translations.",
    icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></>,
  },
];

// On phones, Analytics and Marketing live here instead of the bottom bar.
export const MOBILE_SECTIONS = [
  {
    href: "/dashboard/analytics", label: "Analytics",
    desc: "Who’s viewing your menu, your most viewed and most ordered dishes, busiest hours.",
    icon: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  },
  {
    href: "/dashboard/marketing", label: "Marketing",
    desc: "Meta Pixel, Google and TikTok tags, and a popup message for guests.",
    icon: <><path d="M3 11l15-6v14L3 13z" /><path d="M18 9a3 3 0 0 1 0 6" /><path d="M7 13.5l1.2 4.6a1.5 1.5 0 0 0 2.9-.8L10 14.6" /></>,
  },
];
