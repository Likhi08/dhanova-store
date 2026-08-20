import "dotenv/config";
import mongoose from "mongoose";
import { connectToDatabase } from "../config/database.js";
import Product from "../models/Product.js";

const HALDIRAMS_SOURCE = "Haldirams Product Catalogue workbook";
const BEAUTY_SOURCE = "Beauty Products Catalogue workbook";
const CADBURY_SOURCE = "Cadbury Product Catalogue workbook";
const DRY_FRUITS_SOURCE = "Wholesale Dryfruits reference catalog";
const BICD_SOURCE = "Biscuits Ice Creams Cool Drinks Catalogue workbook";
const IMPORTED_SOURCES = [HALDIRAMS_SOURCE, BEAUTY_SOURCE, CADBURY_SOURCE, BICD_SOURCE];
const visibleFilter = {
  $or: [
    { "specifications.source": { $in: IMPORTED_SOURCES } },
    { "specifications.source": DRY_FRUITS_SOURCE, "specifications.standardPackSize": { $exists: true } },
    { category: "Electronics" },
  ],
};

await connectToDatabase();
try {
  const [hidden, restored] = await Promise.all([
    Product.updateMany({ $nor: visibleFilter.$or, isActive: true }, { $set: { isActive: false } }),
    Product.updateMany({ ...visibleFilter, isActive: false }, { $set: { isActive: true } }),
  ]);
  const [activeProducts, electronics, haldirams, beauty, cadbury, dryFruits, biscuitsIceCreamDrinks] = await Promise.all([
    Product.countDocuments({ isActive: true }),
    Product.countDocuments({ isActive: true, category: "Electronics" }),
    Product.countDocuments({ isActive: true, "specifications.source": HALDIRAMS_SOURCE }),
    Product.countDocuments({ isActive: true, "specifications.source": BEAUTY_SOURCE }),
    Product.countDocuments({ isActive: true, "specifications.source": CADBURY_SOURCE }),
    Product.countDocuments({ isActive: true, "specifications.source": DRY_FRUITS_SOURCE, "specifications.standardPackSize": { $exists: true } }),
    Product.countDocuments({ isActive: true, "specifications.source": BICD_SOURCE }),
  ]);
  console.log(`${hidden.modifiedCount} unrelated products hidden; ${restored.modifiedCount} curated products restored.`);
  console.log(`${activeProducts} visible products: ${electronics} Electronics, ${haldirams} Haldiram's, ${beauty} Beauty, ${cadbury} Cadbury, ${dryFruits} Dry Fruits, and ${biscuitsIceCreamDrinks} Biscuits/Ice Cream/Cool Drinks.`);
} finally {
  await mongoose.disconnect();
}
