// The example menu shown from the /lp2 "Menu example" button (mnu.digital/m/demo), built by
// Admin → Demo menu under the admin's account. Uses every guest-facing feature.
export const DEMO_SLUG = "demo";

type DemoDish = { name: string; description: string; price: number | null; tags?: string[]; options?: { name: string; price: number | null }[]; image?: string };

export const DEMO_VENUE = {
  name: "Olive & Salt",
  type: "Restaurant",
  currency: "$",
  brand: "#2f3e36",
  theme: "classic",
  font: "outfit",
  tables: 12,
  ordering_on: true, dinein: true, takeaway: true, delivery: true, ask_phone: "optional", notes: true,
  primary_lang: "en",
  langs: ["en", "he", "ar", "es"],
  is_public: true,
  setup_done: true,
  timezone: "America/New_York",
  info: {
    about: "A Mediterranean kitchen in the heart of Brooklyn. Wood-fired breads, fresh fish and long dinners with friends.",
    phone: "+1 718 555 0142",
    address: "214 Bedford Ave, Brooklyn, NY 11249",
    wifi_name: "OliveAndSalt-Guests",
    wifi_password: "welcome2026",
    hours: "Kitchen closes 30 minutes before closing time.",
    schedule: {
      format: "12",
      days: {
        sun: [["11:00", "21:00"]],
        mon: [],
        tue: [["12:00", "15:00"], ["17:30", "22:00"]],
        wed: [["12:00", "15:00"], ["17:30", "22:00"]],
        thu: [["12:00", "15:00"], ["17:30", "22:00"]],
        fri: [["12:00", "15:00"], ["17:30", "23:30"]],
        sat: [["11:00", "23:30"]],
      },
    },
    search: true,
  },
  marketing: {
    popup: { enabled: true, title: "Happy hour, 5–7 PM", body: "Half-price house wine and our sourdough with dips, every weekday.", delay: 3, frequency: "once", version: 1 },
  },
};

export const DEMO_MENU: { name: string; dishes: DemoDish[] }[] = [
  { name: "Starters", dishes: [
    { name: "Sourdough & dips", description: "Warm wood-fired sourdough with tahini, tomato salsa and olive oil.", price: 12, tags: ["Vegan"], image: "/assets/food/bread.jpg" },
    { name: "Burrata", description: "Creamy burrata, heirloom tomatoes, basil oil and toasted pine nuts.", price: 17, tags: ["Vegetarian", "Dairy", "Contains nuts"] },
    { name: "Crispy calamari", description: "Lightly fried squid, lemon, smoked paprika aioli.", price: 16, tags: ["Fish"] },
    { name: "Crinkle fries", description: "Sea salt and chipotle aioli.", price: 9, tags: ["Vegetarian"], image: "/assets/food/fries.jpg" },
  ] },
  { name: "Salads", dishes: [
    { name: "Goat cheese salad", description: "Frisée, warm goat cheese, walnuts, honey and balsamic.", price: 16, tags: ["Vegetarian", "Dairy", "Contains nuts"], image: "/assets/food/salad.jpg" },
    { name: "Fattoush", description: "Crunchy vegetables, toasted pita, sumac and pomegranate dressing.", price: 14, tags: ["Vegan"] },
  ] },
  { name: "Mains", dishes: [
    { name: "Grilled salmon", description: "Salmon fillet, lemon, dill, olive oil and seasonal greens.", price: 29, tags: ["Fish", "Gluten-free"], image: "/assets/food/salmon.jpg" },
    { name: "Lamb kofta", description: "Charcoal-grilled lamb skewers, tahini, grilled tomato and flatbread.", price: 27 },
    { name: "Shakshuka", description: "Eggs baked in spiced tomato and pepper sauce, feta and sourdough.", price: 19, tags: ["Vegetarian", "Spicy"] },
    { name: "Rigatoni arrabbiata", description: "Fresh rigatoni, slow-cooked tomato, chili and pecorino.", price: 21, tags: ["Vegetarian", "Spicy"], options: [{ name: "Regular", price: null }, { name: "Large", price: 26 }] },
  ] },
  { name: "Pizza", dishes: [
    { name: "Margherita", description: "San Marzano tomato, fior di latte, basil.", price: 18, tags: ["Vegetarian", "Dairy"], options: [{ name: "Small", price: 14 }, { name: "Large", price: null }] },
    { name: "Mushroom & truffle", description: "Wild mushrooms, mozzarella, thyme and truffle oil.", price: 23, tags: ["Vegetarian"], options: [{ name: "Small", price: 18 }, { name: "Large", price: null }] },
  ] },
  { name: "Desserts", dishes: [
    { name: "Basque cheesecake", description: "Burnt-top cheesecake with seasonal berries.", price: 12, tags: ["Vegetarian", "Dairy"] },
    { name: "Chocolate mousse", description: "Dark chocolate, olive oil and flaky sea salt.", price: 11, tags: ["Vegetarian", "Gluten-free"] },
  ] },
  { name: "Coffee & drinks", dishes: [
    { name: "Espresso", description: "Single origin, roasted in Brooklyn.", price: 4, image: "/assets/food/espresso.jpg", options: [{ name: "Single", price: null }, { name: "Double", price: 5 }] },
    { name: "Flat white", description: "Double shot with silky milk. Oat milk on request.", price: 5.5, tags: ["Dairy"] },
    { name: "Fresh mint lemonade", description: "Lemon, fresh mint and a little sugar, blended with ice.", price: 7, tags: ["Vegan"] },
    { name: "House wine", description: "Red or white, ask us what's open today.", price: 11, options: [{ name: "Glass", price: null }, { name: "Bottle", price: 42 }] },
  ] },
];
