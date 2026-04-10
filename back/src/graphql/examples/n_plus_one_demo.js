import DataLoader from "dataloader";

// This demo is self-contained and does not touch the real database.
// It simulates model methods and prints the simulated DB calls so you
// can see the difference between a naive per-item lookup and a
// DataLoader-batched lookup.

// --- simulated models --------------------------------------------------
const UserModel = {
  async findById(id) {
    // simulate a single-row DB query
    console.log(`DB QUERY: User.findById(${id})`);
    return { id: String(id), name: `User ${id}` };
  },

  async findByIds(ids = []) {
    // simulate a batched DB query
    console.log(`DB QUERY: User.findByIds([${ids.join(", ")}])`);
    return ids.map((id) => ({ id: String(id), name: `User ${id}` }));
  }
};

// Sample documents returned by a paged query
const documents = Array.from({ length: 6 }, (_, i) => ({
  id: String(i + 1),
  title: `Document ${i + 1}`,
  // owners repeat so batching is visible (owners 1..3)
  owner: String((i % 3) + 1)
}));

async function naiveApproach(docs) {
  console.log("--- Naive approach (N+1) ---");
  // imagine we already fetched `docs` with one query
  for (const doc of docs) {
    const owner = await UserModel.findById(doc.owner);
    console.log(`doc=${doc.id} owner=${owner.name}`);
  }
}

async function dataloaderApproach(docs) {
  console.log("--- DataLoader approach (batched) ---");

  // create a DataLoader that batches calls to UserModel.findByIds
  const userLoader = new DataLoader(async (keys) => {
    // keys is an array of owner ids
    const rows = await UserModel.findByIds(keys);
    // ensure ordering matches keys
    const byId = new Map(rows.map((r) => [String(r.id), r]));
    return keys.map((k) => byId.get(String(k)) || null);
  });

  // schedule all loads without awaiting to allow batching
  const promises = docs.map((d) => userLoader.load(d.owner));
  const owners = await Promise.all(promises);

  for (let i = 0; i < docs.length; i++) {
    console.log(`doc=${docs[i].id} owner=${owners[i].name}`);
  }
}

async function run() {
  await naiveApproach(documents);
  console.log("");
  await dataloaderApproach(documents);
}

if (require.main === module) {
  run().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
