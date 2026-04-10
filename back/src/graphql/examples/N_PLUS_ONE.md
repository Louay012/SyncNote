# N+1 (N+1) Example — Naive vs DataLoader

This example demonstrates the classic GraphQL N+1 problem and shows how the app's `loaders` (DataLoader) resolve it.

Files:
- `n_plus_one_demo.js`: runnable demo (no DB required) that simulates the naive access pattern and the DataLoader batched pattern.

Scenario:
- GraphQL query: fetch a page of documents and for each document include the `owner` user.

Naive resolver (problem):

```js
// naive resolver for Document.owner
owner: async (doc, _, contextValue) => {
  // This issues a DB query per document when resolving a list
  return await User.findById(doc.owner);
}
```

When the client requests `myDocuments { items { id title owner { id name } } }`, the server fetches the documents (1 query) then calls `User.findById(...)` separately for each document owner — producing N additional queries (N+1 total).

Fixed resolver (what this app uses):

```js
// loader-based resolver for Document.owner (current app pattern)
owner: async (doc, _, contextValue) =>
  contextValue.loaders.usersById.load(String(doc.owner));
```

This defers per-item lookups to the DataLoader (`usersById`) which batches `load()` calls issued during the GraphQL operation into a single `findByIds(ids)` call.

Demo script:
- Run `node back/src/graphql/examples/n_plus_one_demo.js` from the repo root (requires Node, no DB required). It prints the simulated DB calls for both approaches.

See the demo script for a quick simulated run and console output.
