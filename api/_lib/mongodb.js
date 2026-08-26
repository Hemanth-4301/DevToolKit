import { MongoClient } from "mongodb";

const DB_NAME = process.env.MONGODB_DB || "devtoolkit";
const COLLECTION_NAME = "codeShares";

// Vercel serverless functions can reuse a warm container between
// invocations, so caching the client on `global` avoids opening a new
// MongoDB connection (and exhausting Atlas connection limits) on every
// request within the same warm instance.
let cachedClient = global._mongoClientPromise;

function getClientPromise() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI environment variable is not set");
  }
  if (!cachedClient) {
    const client = new MongoClient(uri);
    cachedClient = client.connect();
    global._mongoClientPromise = cachedClient;
  }
  return cachedClient;
}

let indexesEnsured = false;

export async function getSharesCollection() {
  const client = await getClientPromise();
  const collection = client.db(DB_NAME).collection(COLLECTION_NAME);

  if (!indexesEnsured) {
    indexesEnsured = true;
    await collection.createIndex({ shareId: 1 }, { unique: true }).catch(() => {
      // Index creation is best-effort — if it fails (e.g. race with another
      // warm instance doing the same thing), the collection still works.
    });
  }

  return collection;
}
