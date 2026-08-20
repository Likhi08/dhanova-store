import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const targetTotal = Number(process.env.CATALOGUE_TARGET ?? 10_000);
const minimumPerCategory = Number(process.env.CATALOGUE_CATEGORY_MINIMUM ?? 1_000);

type Department = {
  category: string;
  brands: string[];
  items: Array<[name: string, subcategory: string, basePrice: number, quantities: string[]]>;
  variants: string[];
  image: (itemIndex: number) => string;
};

const localImage = (folder: string) => (itemIndex: number) => `/product-images/${folder}/${itemIndex % 10}.webp`;
const fallbackImage = (name: string) => () => `/product-images/catalogue-fallbacks/${name}.png`;

const departments: Department[] = [
  { category: "Fresh Produce", brands: ["Dhanova Fresh", "Green Basket", "FarmRoot", "Nature Cart", "Daily Harvest"], variants: ["Farm Fresh", "Premium", "Naturally Grown", "Daily Select", "Value Pack", "Organic", "Local", "Chef's Choice", "Family", "Everyday"], image: localImage("fresh-produce"), items: [["Tomatoes", "Fresh Vegetables", 32, ["500 g", "1 kg"]], ["Potatoes", "Fresh Vegetables", 28, ["1 kg", "2 kg"]], ["Onions", "Fresh Vegetables", 35, ["1 kg", "2 kg"]], ["Bananas", "Fresh Fruits", 48, ["500 g", "1 kg"]], ["Apples", "Fresh Fruits", 145, ["4 pcs", "1 kg"]], ["Oranges", "Fresh Fruits", 95, ["500 g", "1 kg"]], ["Spinach", "Leafy Vegetables", 25, ["1 bunch", "250 g"]], ["Coriander", "Leafy Vegetables", 15, ["1 bunch", "100 g"]], ["Carrots", "Fresh Vegetables", 55, ["500 g", "1 kg"]], ["Cucumbers", "Fresh Vegetables", 42, ["500 g", "1 kg"]]] },
  { category: "Dairy & Breakfast", brands: ["Dhanova Dairy", "Morning Meadow", "PureMoo", "Breakfast Co", "MilkyWay Farms"], variants: ["Classic", "Fresh", "High Protein", "Family", "Lite", "Daily", "Creamy", "Fortified", "Premium", "Value"], image: localImage("dairy-breakfast"), items: [["Toned Milk", "Milk", 30, ["500 ml", "1 L"]], ["Fresh Curd", "Curd & Yogurt", 40, ["400 g", "1 kg"]], ["Paneer", "Paneer & Tofu", 95, ["200 g", "500 g"]], ["Salted Butter", "Butter", 58, ["100 g", "500 g"]], ["Brown Bread", "Bread", 48, ["400 g", "600 g"]], ["Farm Eggs", "Eggs", 72, ["6 pcs", "12 pcs"]], ["Rolled Oats", "Cereals", 110, ["500 g", "1 kg"]], ["Corn Flakes", "Cereals", 135, ["475 g", "875 g"]], ["Fruit Yogurt", "Curd & Yogurt", 45, ["100 g", "400 g"]], ["Cheese Slices", "Cheese", 125, ["10 slices", "20 slices"]]] },
  { category: "Snacks", brands: ["Dhanova Bites", "CrunchCraft", "Snack Street", "MunchBox", "Happy Crunch"], variants: ["Classic Salted", "Spicy Masala", "Tangy Tomato", "Cheese", "Sweet Chilli", "Peri Peri", "Mint", "Barbecue", "Lightly Salted", "Extra Crunchy"], image: localImage("snacks"), items: [["Potato Chips", "Chips", 25, ["52 g", "90 g"]], ["Corn Nachos", "Nachos", 45, ["60 g", "150 g"]], ["Roasted Peanuts", "Nuts & Seeds", 55, ["100 g", "250 g"]], ["Bhujia", "Namkeen", 40, ["200 g", "400 g"]], ["Popcorn", "Popcorn", 35, ["60 g", "180 g"]], ["Cream Biscuits", "Biscuits", 30, ["120 g", "300 g"]], ["Khakhra", "Indian Snacks", 65, ["200 g", "400 g"]], ["Trail Mix", "Healthy Snacks", 120, ["100 g", "250 g"]], ["Energy Bar", "Healthy Snacks", 50, ["40 g", "Pack of 6"]], ["Instant Noodles", "Instant Food", 18, ["70 g", "Pack of 6"]]] },
  { category: "Dry Fruits", brands: ["Dhanova Select", "NutriHarvest", "Royal Orchard", "Golden Kernel", "Nature's Bounty"], variants: ["Classic", "Premium", "Organic", "Jumbo", "Roasted", "Unsalted", "Daily Value", "Festive", "Wholesale", "Export Quality"], image: localImage("snacks"), items: [["California Almonds", "Dry Fruits", 245, ["200 g", "500 g"]], ["Whole Cashews", "Dry Fruits", 285, ["200 g", "500 g"]], ["Pistachios", "Dry Fruits", 315, ["200 g", "500 g"]], ["Walnut Kernels", "Dry Fruits", 295, ["200 g", "500 g"]], ["Seedless Raisins", "Dry Fruits", 145, ["250 g", "1 kg"]], ["Medjool Dates", "Dry Fruits", 260, ["250 g", "1 kg"]], ["Dried Figs", "Dry Fruits", 275, ["200 g", "500 g"]], ["Dried Apricots", "Dry Fruits", 230, ["200 g", "500 g"]], ["Pumpkin Seeds", "Dry Fruits", 165, ["200 g", "1 kg"]], ["Premium Nut Mix", "Dry Fruits", 340, ["200 g", "500 g"]]] },
  { category: "Pantry & Staples", brands: ["Dhanova Pantry", "Grain House", "Daily Staples", "Kitchen Roots", "Pure Harvest"], variants: ["Classic", "Premium", "Organic", "Everyday", "Family", "Traditional", "Select", "Stone Ground", "Value", "Chef's Choice"], image: fallbackImage("staples"), items: [["Basmati Rice", "Rice", 125, ["1 kg", "5 kg"]], ["Wheat Flour", "Flour", 55, ["1 kg", "5 kg"]], ["Toor Dal", "Pulses", 145, ["500 g", "1 kg"]], ["Chana Dal", "Pulses", 90, ["500 g", "1 kg"]], ["Sunflower Oil", "Cooking Oil", 135, ["1 L", "5 L"]], ["Sugar", "Salt & Sugar", 48, ["1 kg", "5 kg"]], ["Iodised Salt", "Salt & Sugar", 28, ["1 kg", "2 kg"]], ["Turmeric Powder", "Spices", 65, ["100 g", "500 g"]], ["Red Chilli Powder", "Spices", 75, ["100 g", "500 g"]], ["Mango Pickle", "Pickles", 110, ["300 g", "1 kg"]]] },
  { category: "Beverages", brands: ["Dhanova Drinks", "SipJoy", "FreshFlow", "Urban Sip", "CoolSpring"], variants: ["Original", "No Added Sugar", "Refreshing", "Premium", "Family", "Classic", "Lite", "Natural", "Chilled", "Value"], image: localImage("beverages"), items: [["Mineral Water", "Water", 20, ["1 L", "2 L"]], ["Cola Drink", "Soft Drinks", 40, ["750 ml", "2.25 L"]], ["Orange Juice", "Juices", 95, ["1 L", "2 L"]], ["Mango Drink", "Juices", 75, ["600 ml", "1.2 L"]], ["Coconut Water", "Healthy Drinks", 55, ["200 ml", "1 L"]], ["Energy Drink", "Energy Drinks", 110, ["250 ml", "Pack of 4"]], ["Cold Coffee", "Coffee", 45, ["200 ml", "750 ml"]], ["Green Tea", "Tea", 145, ["25 bags", "100 bags"]], ["Lemon Iced Tea", "Iced Tea", 50, ["500 ml", "1 L"]], ["Buttermilk", "Traditional Drinks", 25, ["200 ml", "1 L"]]] },
  { category: "Household", brands: ["Dhanova Home", "CleanNest", "SparkleWorks", "HomeBright", "PureHouse"], variants: ["Fresh Lemon", "Power Clean", "Eco Care", "Ultra", "Everyday", "Floral", "Anti-Bacterial", "Professional", "Concentrated", "Family"], image: localImage("household"), items: [["Floor Cleaner", "Cleaning Supplies", 135, ["1 L", "2 L"]], ["Dishwash Liquid", "Dishwashing", 95, ["500 ml", "2 L"]], ["Laundry Detergent", "Laundry", 125, ["1 kg", "4 kg"]], ["Fabric Conditioner", "Laundry", 110, ["860 ml", "2 L"]], ["Toilet Cleaner", "Bathroom Cleaning", 99, ["500 ml", "1 L"]], ["Garbage Bags", "Home Utility", 75, ["30 bags", "90 bags"]], ["Kitchen Towels", "Paper Products", 85, ["2 rolls", "6 rolls"]], ["Aluminium Foil", "Kitchen Utility", 95, ["9 m", "25 m"]], ["Air Freshener", "Home Fragrance", 149, ["240 ml", "300 ml"]], ["Mosquito Repellent", "Pest Control", 89, ["45 ml", "Pack of 3"]]] },
  { category: "Home Decor", brands: ["Dhanova Living", "Casa Aura", "Urban Nest", "Decor Story", "Home Canvas"], variants: ["Modern", "Classic", "Handcrafted", "Minimal", "Premium", "Rustic", "Contemporary", "Artisan", "Signature", "Everyday"], image: fallbackImage("home-decor"), items: [["Ceramic Vase", "Vases", 599, ["1 unit", "Set of 2"]], ["Wall Painting", "Wall Art", 1299, ["1 canvas", "Set of 3"]], ["Table Lamp", "Lighting", 1499, ["1 unit", "Set of 2"]], ["Cushion Covers", "Soft Furnishings", 499, ["Set of 2", "Set of 5"]], ["Photo Frame", "Frames", 399, ["1 unit", "Set of 4"]], ["Planter", "Planters", 699, ["1 unit", "Set of 3"]], ["Wall Shelf", "Wall Shelves", 1299, ["1 unit", "Set of 3"]], ["Table Runner", "Table Linen", 799, ["1 runner", "Runner set"]], ["Showpiece", "Showpieces", 899, ["1 unit", "Set of 2"]], ["Scented Candle", "Candles", 349, ["1 candle", "Set of 4"]]] },
  { category: "Personal Care", brands: ["Dhanova Care", "GlowKind", "PureSelf", "Everyday You", "FreshAura"], variants: ["Gentle", "Herbal", "Fresh", "Deep Care", "Sensitive", "Nourishing", "Hydrating", "Natural", "Advanced", "Daily"], image: localImage("personal-care"), items: [["Bathing Soap", "Bath & Body", 42, ["100 g", "Pack of 4"]], ["Shampoo", "Hair Care", 145, ["340 ml", "650 ml"]], ["Conditioner", "Hair Care", 165, ["180 ml", "350 ml"]], ["Face Wash", "Skin Care", 125, ["100 ml", "200 ml"]], ["Body Lotion", "Skin Care", 185, ["200 ml", "400 ml"]], ["Toothpaste", "Oral Care", 98, ["150 g", "300 g"]], ["Toothbrush", "Oral Care", 45, ["1 pc", "Pack of 4"]], ["Deodorant", "Deodorants", 199, ["150 ml", "200 ml"]], ["Hand Wash", "Bath & Body", 95, ["250 ml", "750 ml"]], ["Sanitary Pads", "Feminine Care", 115, ["Pack of 8", "Pack of 30"]]] },
  { category: "Baby Care", brands: ["Dhanova Baby", "LittleSteps", "TinyNest", "BabyBloom", "HappyTots"], variants: ["Gentle", "Extra Soft", "Daily Care", "Sensitive", "Premium", "Newborn", "Natural", "Comfort", "Advanced", "Value"], image: localImage("baby-care"), items: [["Baby Diapers", "Diapers", 399, ["Pack of 24", "Pack of 72"]], ["Baby Wipes", "Diapers & Wipes", 99, ["72 wipes", "Pack of 3"]], ["Baby Lotion", "Baby Skin Care", 175, ["200 ml", "400 ml"]], ["Baby Shampoo", "Baby Bath", 165, ["200 ml", "500 ml"]], ["Baby Soap", "Baby Bath", 65, ["75 g", "Pack of 4"]], ["Baby Powder", "Baby Skin Care", 145, ["200 g", "400 g"]], ["Infant Cereal", "Baby Food", 245, ["300 g", "600 g"]], ["Baby Food Puree", "Baby Food", 85, ["120 g", "Pack of 6"]], ["Feeding Bottle", "Feeding", 225, ["250 ml", "Pack of 2"]], ["Baby Laundry Liquid", "Baby Laundry", 265, ["1 L", "2 L"]]] },
  { category: "Electronics", brands: ["Dhanova Tech", "VoltEdge", "NexaGear", "Urban Circuit", "SmartNest"], variants: ["Essential", "Plus", "Pro", "Compact", "Smart", "Max", "Air", "Ultra", "Core", "Prime"], image: localImage("electronics"), items: [["Everyday Laptop", "Computers", 45999, ["14 inch", "15.6 inch"]], ["Wireless Earbuds", "Audio", 999, ["1 pair", "1 unit"]], ["Over-Ear Headphones", "Audio", 3499, ["1 unit", "1 unit - black"]], ["Wireless Charger", "Mobile Accessories", 1499, ["15 W", "20 W"]], ["Smart Speaker", "Audio", 3999, ["1 unit", "Mini"]], ["Power Bank", "Mobile Accessories", 1299, ["10000 mAh", "20000 mAh"]], ["Smart Watch", "Smartwatches", 2499, ["40 mm", "44 mm"]], ["USB-C Cable", "Mobile Accessories", 499, ["1 m", "2 m"]], ["Bluetooth Speaker", "Audio", 1899, ["10 W", "20 W"]], ["LED Bulb", "Home Appliances", 299, ["9 W", "12 W"]]] },
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const candidates = departments.flatMap((department, departmentIndex) => department.brands.flatMap((brand, brandIndex) => department.items.flatMap(([item, subcategory, basePrice, quantities], itemIndex) => department.variants.flatMap((variant, variantIndex) => quantities.map((quantity, quantityIndex) => {
  const name = `${brand} ${variant} ${item} – ${quantity}`;
  const price = Math.round(basePrice * (1 + brandIndex * .045 + variantIndex * .025 + quantityIndex * .14));
  return {
    name,
    slug: `catalogue-expansion-${slugify(department.category)}-${slugify(name)}`,
    description: `${variant} ${item.toLowerCase()} from ${brand}, supplied in a ${quantity} pack for convenient everyday shopping.`,
    brand,
    category: department.category,
    subcategory,
    price,
    ...(department.category === "Dry Fruits" ? { wholesalePrice: Math.round(price * .82) } : {}),
    compareAtPrice: Math.ceil(price * 1.12),
    rating: Number((3.8 + ((departmentIndex + brandIndex + itemIndex + variantIndex) % 12) / 10).toFixed(1)),
    stock: 25 + ((departmentIndex * 997 + brandIndex * 173 + itemIndex * 31 + variantIndex * 7 + quantityIndex) % 276),
    quantity,
    images: [department.image(itemIndex)],
    specifications: new Map([["company", brand], ["packQuantity", quantity]]),
    tags: [department.category, subcategory, item, brand, variant],
    isActive: true,
  };
})))));

await connectToDatabase();
const activeBefore = await Product.countDocuments({ isActive: true });
const existingSlugs = new Set((await Product.find({ slug: { $in: candidates.map((product) => product.slug) }, isActive: true }).select("slug").lean()).map((product) => product.slug));
const availableCandidates = candidates.filter((product) => !existingSlugs.has(product.slug));
const categoryCounts = new Map((await Product.aggregate<{ _id: string; count: number }>([
  { $match: { isActive: true, category: { $in: departments.map((department) => department.category) } } },
  { $group: { _id: "$category", count: { $sum: 1 } } },
])).map((item) => [item._id, item.count]));

const additions = departments.flatMap((department) => {
  const needed = Math.max(0, minimumPerCategory - (categoryCounts.get(department.category) ?? 0));
  const available = availableCandidates.filter((product) => product.category === department.category);
  if (available.length < needed) throw new Error(`${department.category} needs ${needed} products, but only ${available.length} expansion products are available.`);
  return available.slice(0, needed);
});

const selectedSlugs = new Set(additions.map((product) => product.slug));
const totalAfterMinimums = activeBefore + additions.length;
if (totalAfterMinimums < targetTotal) {
  const totalNeeded = targetTotal - totalAfterMinimums;
  const remaining = availableCandidates.filter((product) => !selectedSlugs.has(product.slug));
  if (remaining.length < totalNeeded) throw new Error(`Catalogue needs ${totalNeeded} more products, but only ${remaining.length} expansion products are available.`);
  additions.push(...remaining.slice(0, totalNeeded));
}

for (let start = 0; start < additions.length; start += 500) {
  const batch = additions.slice(start, start + 500);
  await Product.bulkWrite(batch.map((product) => ({ updateOne: { filter: { slug: product.slug }, update: { $set: product }, upsert: true } })), { ordered: false });
}

const activeAfter = await Product.countDocuments({ isActive: true });
const finalCategoryCounts = await Product.aggregate<{ _id: string; count: number }>([
  { $match: { isActive: true, category: { $in: departments.map((department) => department.category) } } },
  { $group: { _id: "$category", count: { $sum: 1 } } },
  { $sort: { _id: 1 } },
]);
const belowMinimum = finalCategoryCounts.filter((item) => item.count < minimumPerCategory);
if (activeAfter < targetTotal || belowMinimum.length > 0) throw new Error(`Catalogue validation failed: ${activeAfter} active products; ${belowMinimum.length} categories below minimum.`);
console.log(`Catalogue expanded from ${activeBefore} to ${activeAfter} active products (${additions.length} added).`);
console.log(finalCategoryCounts.map((item) => `${item._id}: ${item.count}`).join("\n"));
await mongoose.disconnect();
