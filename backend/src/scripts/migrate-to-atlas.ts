import mongoose from "mongoose";

const sourceUri = process.env.SOURCE_MONGODB_URI ?? "mongodb://127.0.0.1:27017/dhanova";
const targetUri = process.env.TARGET_MONGODB_URI;
if (!targetUri) throw new Error("TARGET_MONGODB_URI is required");

const source = new mongoose.mongo.MongoClient(sourceUri);
const target = new mongoose.mongo.MongoClient(targetUri);
await Promise.all([source.connect(), target.connect()]);

try {
  const sourceDatabase = source.db();
  const targetDatabase = target.db();
  const names = ["products", "users", "carts", "orders"];
  for (const name of names) {
    const documents = await sourceDatabase.collection(name).find({}).toArray();
    if (!documents.length) continue;
    await targetDatabase.collection(name).deleteMany({});
    await targetDatabase.collection(name).insertMany(documents, { ordered: false });
    console.log(`Migrated ${documents.length} ${name}.`);
  }
} finally {
  await Promise.all([source.close(), target.close()]);
}
