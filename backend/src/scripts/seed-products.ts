import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

type Department = {
  category: string;
  brands: string[];
  variants: string[];
  items: Array<{ name: string; subcategory: string; basePrice: number; quantities: string[] }>;
};

const departments: Department[] = [
  {
    category: "Fresh Produce",
    brands: ["Dhanova Fresh", "Green Basket", "FarmRoot", "Daily Harvest", "Nature Cart"],
    variants: ["Farm Fresh", "Premium", "Naturally Grown", "Daily Select", "Value Pack"],
    items: [
      ["Tomatoes", "Fresh Vegetables", 32, ["500 g", "1 kg"]], ["Potatoes", "Fresh Vegetables", 28, ["1 kg", "2 kg"]],
      ["Onions", "Fresh Vegetables", 35, ["1 kg", "2 kg"]], ["Bananas", "Fresh Fruits", 48, ["500 g", "1 kg"]],
      ["Apples", "Fresh Fruits", 145, ["4 pcs", "1 kg"]], ["Oranges", "Fresh Fruits", 95, ["500 g", "1 kg"]],
      ["Spinach", "Leafy Vegetables", 25, ["1 bunch", "250 g"]], ["Coriander", "Leafy Vegetables", 15, ["1 bunch", "100 g"]],
      ["Carrots", "Fresh Vegetables", 55, ["500 g", "1 kg"]], ["Cucumbers", "Fresh Vegetables", 42, ["500 g", "1 kg"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Dairy & Breakfast",
    brands: ["Dhanova Dairy", "Morning Meadow", "MilkyWay Farms", "Breakfast Co", "PureMoo"],
    variants: ["Classic", "Fresh", "High Protein", "Family", "Lite"],
    items: [
      ["Toned Milk", "Milk", 30, ["500 ml", "1 L"]], ["Fresh Curd", "Curd & Yogurt", 40, ["400 g", "1 kg"]],
      ["Paneer", "Paneer & Tofu", 95, ["200 g", "500 g"]], ["Salted Butter", "Butter", 58, ["100 g", "500 g"]],
      ["Brown Bread", "Bread", 48, ["400 g", "600 g"]], ["Farm Eggs", "Eggs", 72, ["6 pcs", "12 pcs"]],
      ["Rolled Oats", "Cereals", 110, ["500 g", "1 kg"]], ["Corn Flakes", "Cereals", 135, ["475 g", "875 g"]],
      ["Fruit Yogurt", "Curd & Yogurt", 45, ["100 g", "400 g"]], ["Cheese Slices", "Cheese", 125, ["10 slices", "20 slices"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Snacks",
    brands: ["Dhanova Bites", "CrunchCraft", "Snack Street", "MunchBox", "Happy Crunch"],
    variants: ["Classic Salted", "Spicy Masala", "Tangy Tomato", "Cheese", "Sweet Chilli"],
    items: [
      ["Potato Chips", "Chips", 25, ["52 g", "90 g"]], ["Corn Nachos", "Nachos", 45, ["60 g", "150 g"]],
      ["Roasted Peanuts", "Nuts & Seeds", 55, ["100 g", "250 g"]], ["Bhujia", "Namkeen", 40, ["200 g", "400 g"]],
      ["Popcorn", "Popcorn", 35, ["60 g", "180 g"]], ["Cream Biscuits", "Biscuits", 30, ["120 g", "300 g"]],
      ["Khakhra", "Indian Snacks", 65, ["200 g", "400 g"]], ["Trail Mix", "Healthy Snacks", 120, ["100 g", "250 g"]],
      ["Energy Bar", "Healthy Snacks", 50, ["40 g", "Pack of 6"]], ["Instant Noodles", "Instant Food", 18, ["70 g", "Pack of 6"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Beverages",
    brands: ["Dhanova Drinks", "SipJoy", "FreshFlow", "Urban Sip", "CoolSpring"],
    variants: ["Original", "No Added Sugar", "Refreshing", "Premium", "Family"],
    items: [
      ["Mineral Water", "Water", 20, ["1 L", "2 L"]], ["Cola Drink", "Soft Drinks", 40, ["750 ml", "2.25 L"]],
      ["Orange Juice", "Juices", 95, ["1 L", "2 L"]], ["Mango Drink", "Juices", 75, ["600 ml", "1.2 L"]],
      ["Coconut Water", "Healthy Drinks", 55, ["200 ml", "1 L"]], ["Energy Drink", "Energy Drinks", 110, ["250 ml", "Pack of 4"]],
      ["Cold Coffee", "Coffee", 45, ["200 ml", "750 ml"]], ["Green Tea", "Tea", 145, ["25 bags", "100 bags"]],
      ["Lemon Iced Tea", "Iced Tea", 50, ["500 ml", "1 L"]], ["Buttermilk", "Traditional Drinks", 25, ["200 ml", "1 L"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Household",
    brands: ["Dhanova Home", "CleanNest", "SparkleWorks", "HomeBright", "PureHouse"],
    variants: ["Fresh Lemon", "Power Clean", "Eco Care", "Ultra", "Everyday"],
    items: [
      ["Floor Cleaner", "Cleaning Supplies", 135, ["1 L", "2 L"]], ["Dishwash Liquid", "Dishwashing", 95, ["500 ml", "2 L"]],
      ["Laundry Detergent", "Laundry", 125, ["1 kg", "4 kg"]], ["Fabric Conditioner", "Laundry", 110, ["860 ml", "2 L"]],
      ["Toilet Cleaner", "Bathroom Cleaning", 99, ["500 ml", "1 L"]], ["Garbage Bags", "Home Utility", 75, ["30 bags", "90 bags"]],
      ["Kitchen Towels", "Paper Products", 85, ["2 rolls", "6 rolls"]], ["Aluminium Foil", "Kitchen Utility", 95, ["9 m", "25 m"]],
      ["Air Freshener", "Home Fragrance", 149, ["240 ml", "300 ml"]], ["Mosquito Repellent", "Pest Control", 89, ["45 ml", "Pack of 3"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Personal Care",
    brands: ["Dhanova Care", "GlowKind", "PureSelf", "Everyday You", "FreshAura"],
    variants: ["Gentle", "Herbal", "Fresh", "Deep Care", "Sensitive"],
    items: [
      ["Bathing Soap", "Bath & Body", 42, ["100 g", "Pack of 4"]], ["Shampoo", "Hair Care", 145, ["340 ml", "650 ml"]],
      ["Conditioner", "Hair Care", 165, ["180 ml", "350 ml"]], ["Face Wash", "Skin Care", 125, ["100 ml", "200 ml"]],
      ["Body Lotion", "Skin Care", 185, ["200 ml", "400 ml"]], ["Toothpaste", "Oral Care", 98, ["150 g", "300 g"]],
      ["Toothbrush", "Oral Care", 45, ["1 pc", "Pack of 4"]], ["Deodorant", "Deodorants", 199, ["150 ml", "200 ml"]],
      ["Hand Wash", "Bath & Body", 95, ["250 ml", "750 ml"]], ["Sanitary Pads", "Feminine Care", 115, ["Pack of 8", "Pack of 30"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Baby Care",
    brands: ["Dhanova Baby", "LittleSteps", "TinyNest", "BabyBloom", "HappyTots"],
    variants: ["Gentle", "Extra Soft", "Daily Care", "Sensitive", "Premium"],
    items: [
      ["Baby Diapers", "Diapers", 399, ["Pack of 24", "Pack of 72"]], ["Baby Wipes", "Diapers & Wipes", 99, ["72 wipes", "Pack of 3"]],
      ["Baby Lotion", "Baby Skin Care", 175, ["200 ml", "400 ml"]], ["Baby Shampoo", "Baby Bath", 165, ["200 ml", "500 ml"]],
      ["Baby Soap", "Baby Bath", 65, ["75 g", "Pack of 4"]], ["Baby Powder", "Baby Skin Care", 145, ["200 g", "400 g"]],
      ["Infant Cereal", "Baby Food", 245, ["300 g", "600 g"]], ["Baby Food Puree", "Baby Food", 85, ["120 g", "Pack of 6"]],
      ["Feeding Bottle", "Feeding", 225, ["250 ml", "Pack of 2"]], ["Baby Laundry Liquid", "Baby Laundry", 265, ["1 L", "2 L"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Electronics",
    brands: ["Dhanova Tech", "VoltEdge", "NexaGear", "Urban Circuit", "SmartNest"],
    variants: ["Essential", "Plus", "Pro", "Compact", "Smart"],
    items: [
      ["Everyday Laptop", "Computers", 45999, ["14 inch", "15.6 inch"]], ["Dual Screen Laptop", "Computers", 89999, ["14 inch", "15.6 inch"]],
      ["Slim Laptop", "Computers", 52999, ["13.3 inch", "14 inch"]], ["Notebook Laptop", "Computers", 47999, ["14 inch", "15.6 inch"]],
      ["Pro Laptop", "Computers", 74999, ["14 inch", "16 inch"]], ["Smart Speaker", "Audio", 3999, ["1 unit", "1 unit"]],
      ["Wireless Earbuds", "Audio", 999, ["1 pair", "1 unit"]], ["Over-Ear Headphones", "Audio", 3499, ["1 unit", "1 unit"]],
      ["Wireless Charger", "Mobile Accessories", 1499, ["15 W", "20 W"]], ["Mini Smart Speaker", "Audio", 4999, ["1 unit", "1 unit"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
  {
    category: "Dry Fruits",
    brands: ["Dhanova Select", "NutriHarvest", "Royal Orchard", "Golden Kernel", "Nature's Bounty"],
    variants: ["Classic", "Premium", "Organic", "Jumbo", "Roasted", "Unsalted", "Daily Value", "Festive", "Wholesale", "Export Quality"],
    items: [
      ["California Almonds", "Dry Fruits", 245, ["200 g", "500 g", "1 kg"]], ["Whole Cashews", "Dry Fruits", 285, ["200 g", "500 g", "1 kg"]],
      ["Pistachios", "Dry Fruits", 315, ["200 g", "500 g", "1 kg"]], ["Walnut Kernels", "Dry Fruits", 295, ["200 g", "500 g", "1 kg"]],
      ["Seedless Raisins", "Dry Fruits", 145, ["250 g", "500 g", "1 kg"]], ["Medjool Dates", "Dry Fruits", 260, ["250 g", "500 g", "1 kg"]],
      ["Dried Figs", "Dry Fruits", 275, ["200 g", "500 g", "1 kg"]], ["Dried Apricots", "Dry Fruits", 230, ["200 g", "500 g", "1 kg"]],
      ["Dried Prunes", "Dry Fruits", 225, ["200 g", "500 g", "1 kg"]], ["Dried Cranberries", "Dry Fruits", 190, ["200 g", "500 g", "1 kg"]],
      ["Hazelnuts", "Dry Fruits", 320, ["200 g", "500 g", "1 kg"]], ["Pecan Nuts", "Dry Fruits", 360, ["200 g", "500 g", "1 kg"]],
      ["Brazil Nuts", "Dry Fruits", 350, ["200 g", "500 g", "1 kg"]], ["Macadamia Nuts", "Dry Fruits", 425, ["200 g", "500 g", "1 kg"]],
      ["Pine Nuts", "Dry Fruits", 410, ["100 g", "250 g", "500 g"]], ["Pumpkin Seeds", "Dry Fruits", 165, ["200 g", "500 g", "1 kg"]],
      ["Sunflower Seeds", "Dry Fruits", 125, ["200 g", "500 g", "1 kg"]], ["Chia Seeds", "Dry Fruits", 175, ["200 g", "500 g", "1 kg"]],
      ["Flax Seeds", "Dry Fruits", 95, ["200 g", "500 g", "1 kg"]], ["Premium Nut Mix", "Dry Fruits", 340, ["200 g", "500 g", "1 kg"]],
    ].map(([name, subcategory, basePrice, quantities]) => ({ name: name as string, subcategory: subcategory as string, basePrice: basePrice as number, quantities: quantities as string[] })),
  },
];

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const products = departments.flatMap((department, departmentIndex) =>
  department.brands.flatMap((brand, brandIndex) =>
    department.items.flatMap((item, itemIndex) =>
      (department.category === "Dry Fruits" ? department.variants : [...department.variants, ...department.variants.map((variant) => `${variant} Select`)]).map((variant, variantIndex) => {
        const quantity = item.quantities[(brandIndex + variantIndex) % item.quantities.length]!;
        const price = Math.round(item.basePrice * (1 + brandIndex * 0.06 + variantIndex * 0.04));
        const name = `${brand} ${variant} ${item.name}`;
        return {
          name,
          slug: slugify(name),
          description: `${variant} ${item.name.toLowerCase()} from ${brand}, packed for convenient everyday shopping.`,
          brand,
          category: department.category,
          subcategory: item.subcategory,
          price,
          ...(department.category === "Dry Fruits" ? { wholesalePrice: Math.round(price * 0.82) } : {}),
          compareAtPrice: Math.ceil(price * 1.12),
          stock: 25 + ((departmentIndex * 250 + brandIndex * 50 + itemIndex * 5 + variantIndex) % 276),
          quantity,
          images: [department.category === "Dry Fruits" ? `/product-images/snacks/${itemIndex % 10}.webp` : `/product-images/${slugify(department.category)}/${itemIndex}.webp`],
          specifications: new Map([
            ["company", brand],
            ["packQuantity", quantity],
            ...(department.category === "Dry Fruits" ? [["wholesalePrice", `₹${Math.round(price * 0.82)}`] as [string, string]] : []),
          ]),
          tags: [department.category, item.subcategory, item.name, brand],
          isActive: true,
        };
      }),
    ),
  ),
);

if (products.length !== 5000) throw new Error(`Expected 5000 products, generated ${products.length}`);

const brandedProducts = [
  {
    name: "Haldiram's Aloo Bhujia",
    slug: "haldirams-aloo-bhujia-200-g",
    description: "Haldiram's classic thin and crispy potato namkeen seasoned with a savoury Indian spice blend.",
    brand: "Haldiram's", category: "Snacks", subcategory: "Namkeen", price: 60, compareAtPrice: 65, stock: 180, quantity: "200 g",
    images: ["https://cdn.shopify.com/s/files/1/0691/0948/1549/files/1_b5586779-8200-46cc-811d-faef8e78ae07.avif?v=1782794349"],
    specifications: new Map([["company", "Haldiram's"], ["packQuantity", "200 g"], ["source", "Official Haldiram's product page"]]),
    tags: ["Haldiram's", "Aloo Bhujia", "Namkeen", "Snacks"], isActive: true,
  },
  {
    name: "Lay's Classic Salted Potato Chips",
    slug: "lays-classic-salted-potato-chips",
    description: "Lay's classic potato chips with a light salted seasoning and signature crisp texture.",
    brand: "Lay's", category: "Snacks", subcategory: "Chips", price: 40, compareAtPrice: 50, stock: 240, quantity: "52 g",
    images: ["https://cms.lays.com/sites/lays.com/files//2025-12/Lays_XL_Classic_Laydown.png"],
    specifications: new Map([["company", "PepsiCo"], ["packQuantity", "52 g"], ["source", "Official Lay's product page"]]),
    tags: ["Lay's", "Potato Chips", "Classic Salted", "Snacks"], isActive: true,
  },
  {
    name: "Kurkure Masala Munch",
    slug: "kurkure-masala-munch",
    description: "Kurkure Masala Munch crunchy snack with its popular spicy masala seasoning.",
    brand: "Kurkure", category: "Snacks", subcategory: "Indian Snacks", price: 20, compareAtPrice: 25, stock: 260, quantity: "90 g",
    images: ["https://www.pepsnacks.com/prod/s3fs-public/2022-07/Creative_Kurkure-MM.png"],
    specifications: new Map([["company", "PepsiCo India"], ["packQuantity", "90 g"], ["source", "Official PepsiCo snacks page"]]),
    tags: ["Kurkure", "Masala Munch", "Indian Snacks"], isActive: true,
  },
  {
    name: "HP Laptop 15-fc0476AU Ryzen 7",
    slug: "hp-laptop-15-fc0476au-ryzen-7",
    description: "HP 15.6-inch laptop with AMD Ryzen 7 processor, 16 GB RAM, 512 GB SSD and Full HD display.",
    brand: "HP", category: "Electronics", subcategory: "Computers", price: 49359, compareAtPrice: 56903, stock: 32, quantity: "15.6 inch",
    images: ["https://www.hp.com/in-en/shop/media/catalog/product/v/i/victus-by-hp-15-gaming-laptop-roku-opihr-mica-silver-front_m2962619_4016016_1.png?store=in-en&image-type=image&auto=avif&quality=100&format=jpg&bg-color=ffffff&type=image-product&width=244&fit=bounds"],
    specifications: new Map([["company", "HP"], ["display", "15.6 inch"], ["memory", "16 GB RAM"], ["storage", "512 GB SSD"]]),
    tags: ["HP", "Laptop", "Ryzen 7", "Computers"], isActive: true,
  },
  {
    name: "Usha Racer Chrome 1200 mm Ceiling Fan",
    slug: "usha-racer-chrome-1200-mm-ceiling-fan",
    description: "Usha Racer Chrome high-speed ceiling fan with 1200 mm sweep, copper motor and two-year warranty.",
    brand: "Usha", category: "Electronics", subcategory: "Home Appliances", price: 2199, compareAtPrice: 3560, stock: 48, quantity: "1 unit · 1200 mm",
    images: ["https://images.price.tools/images/usha-racer-chrome-1200mm-ultra-high-l-8xNow3z74.jpg"],
    specifications: new Map([["company", "Usha International"], ["sweepSize", "1200 mm"], ["speed", "400 RPM"], ["warranty", "2 years"]]),
    tags: ["Usha", "Ceiling Fan", "Home Appliances"], isActive: true,
  },
  {
    name: "Priya Mango Avakaya Pickle",
    slug: "priya-mango-avakaya-pickle-300-g",
    description: "Priya Foods traditional Andhra-style mango avakaya pickle made with raw mangoes and aromatic spices.",
    brand: "Priya Foods", category: "Pantry & Staples", subcategory: "Pickles", price: 110, compareAtPrice: 125, stock: 130, quantity: "300 g",
    images: ["https://priyafoods.com/cdn/shop/products/MangoAvakayaWG300g.jpg?v=1689145579"],
    specifications: new Map([["company", "Ushodaya Enterprises"], ["packQuantity", "300 g"], ["source", "Official Priya Foods product page"]]),
    tags: ["Priya", "Mango Avakaya", "Pickle", "Pantry"], isActive: true,
  },
];

const marketplaceSeeds = [
  ["Parle-G Original Glucose Biscuits", "Parle", "Snacks", "Biscuits", 90, "800 g", "https://www.parleproducts.com/Uploads/prdsmallimage/100prodsmall_parle-g.png"],
  ["Tata Salt Vacuum Evaporated Iodised Salt", "Tata Salt", "Pantry & Staples", "Salt & Sugar", 28, "1 kg", "https://www.tataconsumer.com/sites/g/files/gfwrlq316/files/Tata-salt-brand-portfolio.jpg"],
  ["Aachi Instant Idiyappam", "Aachi", "Pantry & Staples", "Ready to Cook", 94, "200 g", "https://cdn.shopify.com/s/files/1/0749/3661/5220/files/Instant-Idiyappam-200g.webp?v=1783583548"],
  ["Apple iPhone 17 256GB", "Apple", "Electronics", "Mobiles", 82900, "256 GB", "https://store.storeimages.cdn-apple.com/1/as-images.apple.com/is/iphone-17-finish-unselect-gallery-1-202509_GEO_EMEA?wid=1200&hei=630&fmt=jpeg&qlt=95&.v=1758739981039"],
  ["Samsung Galaxy S26 5G 256GB", "Samsung", "Electronics", "Mobiles", 87999, "256 GB · 12 GB RAM", "https://images.samsung.com/in/smartphones/galaxy-s26/buy/kv_exclusvie_animated_PC_in.png?imbypass=true"],
  ["Redmi Note 15 Pro 5G", "Xiaomi", "Electronics", "Mobiles", 29999, "128 GB · 8 GB RAM", "https://i03.appmifile.com/641_item_in/28/07/2026/d9b574c20f0028534aa3cce75fda52d5.png?width=500&height=500"],
  ["boAt Airdopes Prime 800D Dolby Audio Earbuds", "boAt", "Electronics", "Audio", 1499, "1 pair", "https://cdn.shopify.com/s/files/1/0057/8938/4802/files/1-ProductOverview.png?v=1785318883"],
  ["Noise ALT Buds Truly Wireless Earbuds", "Noise", "Electronics", "Audio", 1399, "1 pair", "https://cdn.shopify.com/s/files/1/0997/6284/files/782_result.webp?v=1783514378"],
  ["Fire-Boltt Rise Dual Tone Smartwatch", "Fire-Boltt", "Electronics", "Smartwatches", 1699, "1 unit", "https://cdn.shopify.com/s/files/1/0137/0292/2286/files/Final.png?v=1780317889"],
  ["Amazfit Bip 5 Smartwatch", "Amazfit", "Electronics", "Smartwatches", 6499, "1 unit", "https://cdn.shopify.com/s/files/1/0266/1371/0884/products/2b88b81321c7510919fdfdbb9c69360e.jpg?v=1691659249"],
  ["Boult AmpVault V20 Pro Earbuds", "Boult", "Electronics", "Audio", 1999, "1 pair", "https://cdn.shopify.com/s/files/1/0548/8849/7221/files/Res_01.webp?v=1785228173"],
  ["Six Mediterranean Handpainted Ceramic Bowls", "ExclusiveLane", "Home Decor", "Tableware", 780, "Set of 6", "https://cdn.shopify.com/s/files/1/0030/9759/1872/products/el-005-394_a.jpg?v=1570516171"],
  ["Ugaoo Garden Rake with Long Handle", "Ugaoo", "Home Decor", "Garden Accessories", 699, "1 unit · 4 ft", "https://cdn.shopify.com/s/files/1/0579/7924/0580/files/pomelli_photoshoot_image_1_1_0729_2_Topaz_Gigapixel_2x_scale.jpg?v=1785390801"],
  ["Sogu Black Hanging Lamp", "Orange Tree", "Home Decor", "Lighting", 6179, "1 unit", "https://cdn.shopify.com/s/files/1/0683/7338/1440/files/3_7ab34e57-8c3d-4458-b565-d0b07c08c925.jpg?v=1781080163"],
  ["Sokai Buxus Decorative Flower Bunch", "HomeStrap", "Home Decor", "Artificial Flowers", 849, "Set of 3", "https://cdn.shopify.com/s/files/1/0715/6773/7154/files/buxus-01.jpg?v=1758881968"],
  ["Cubette Wooden Wall Shelf", "Ellementry", "Home Decor", "Wall Shelves", 5550, "1 unit", "https://cdn.shopify.com/s/files/1/0831/2556/7787/files/WDDEA4810_00.webp?v=1785930445"],
  ["Yellow Ceramic Lemon Platter", "Pure Home + Living", "Home Decor", "Tableware", 1899, "1 large platter", "https://cdn.shopify.com/s/files/1/0694/2428/3942/files/8907895162795_7.jpg?v=1782368268"],
  ["Golden Aura Ceiling Fan with Chandelier Light", "The Decor Kart", "Home Decor", "Lighting", 32000, "1 unit with remote", "https://cdn.shopify.com/s/files/1/0962/2574/files/FNCHAN_3.webp?v=1786359359"],
  ["Rare Rabbit Decorative Showpiece", "Styra", "Home Decor", "Showpieces", 809, "1 unit", "https://cdn.shopify.com/s/files/1/0849/8325/1301/files/styra-rare-rabbit-maroon-1.png?v=1783269898"],
  ["Leafy Vine Embroidered Table Runner Set", "CR Home", "Home Decor", "Table Linen", 9665, "Runner and placemats", "https://cdn.shopify.com/s/files/1/0693/0389/4256/files/Luxury_Table_Runner.jpg?v=1778062816"],
  ["Indian Symmetrical Elephant Canvas Wall Painting", "Vibecrafts", "Home Decor", "Wall Art", 2699, "1 canvas", "https://cdn.shopify.com/s/files/1/0500/0711/3892/files/vibrant-indian-symmetrical-elephant-canvas-wall-painting-PTVCH_4327_2_1.webp?v=1785134838"],
  ["Monstera Deliciosa with Metal Self-Watering Pot", "Kyari", "Home Decor", "Planters & Green Decor", 3299, "1 plant with pot", "https://cdn.shopify.com/s/files/1/0646/8327/8550/files/5_3_6d44c5d7-de86-4ba7-8818-f28120971133.jpg?v=1775126050"],
] as const;

const marketplaceProducts = marketplaceSeeds.map(([name, brand, category, subcategory, price, quantity, image], index) => ({
  name,
  slug: `${slugify(name)}-${index + 1}`,
  description: `${name} by ${brand}, supplied as an authentic branded retail product with matching pack information.`,
  brand,
  category,
  subcategory,
  price,
  compareAtPrice: Math.ceil(price * 1.12),
  stock: 35 + ((index * 17) % 166),
  quantity,
  images: [image],
  specifications: new Map([["company", brand], ["packQuantity", quantity], ["catalogPriceCaptured", "2026-08-10"]]),
  tags: [brand, category, subcategory, name],
  isActive: true,
}));

await connectToDatabase();
const retiredElectronicsItems = ["USB-C Cable", "Fast Charger", "Power Bank", "LED Bulb", "Extension Board", "Smart Watch", "Bluetooth Speaker", "Electric Kettle", "AA Batteries"];
await Product.updateMany(
  { category: "Electronics", name: { $regex: `(?:${retiredElectronicsItems.join("|")})$` } },
  { $set: { isActive: false } },
);
const result = await Product.bulkWrite(
  [...products, ...brandedProducts, ...marketplaceProducts].map((product) => ({
    updateOne: { filter: { slug: product.slug }, update: { $set: product }, upsert: true },
  })),
  { ordered: false },
);
const activeTotal = await Product.countDocuments({ isActive: true });
console.log(`Seed complete: ${result.upsertedCount} inserted, ${result.modifiedCount} updated, ${activeTotal} active products total.`);
await mongoose.disconnect();
