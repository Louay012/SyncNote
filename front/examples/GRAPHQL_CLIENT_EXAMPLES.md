# GraphQL Client Examples (queries, mutations, subscriptions)

This file contains short examples showing how to call GraphQL queries, mutations, and subscribe to updates in this app.

Note: these snippets use the app helpers already present in the repo (`lib/apollo.js` and `lib/graphql.js`).

---

## 1) React hooks (recommended for components)

Query with `useQuery`:

```jsx
import { useQuery } from '@apollo/client';
import { GET_MY_DOCUMENTS } from 'lib/graphql';

export default function MyDocumentsList() {
  const { data, loading, error } = useQuery(GET_MY_DOCUMENTS, {
    variables: { limit: 10 }
  });

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <ul>
      {data.myDocuments.items.map((doc) => (
        <li key={doc.id}>{doc.title} — {doc.owner.name}</li>
      ))}
    </ul>
  );
}
```

Mutation with `useMutation` (with cache update example):

```jsx
import { useMutation } from '@apollo/client';
import { CREATE_DOCUMENT, GET_MY_DOCUMENTS } from 'lib/graphql';

function NewDocButton() {
  const [createDocument, { loading }] = useMutation(CREATE_DOCUMENT, {
    update(cache, { data: { createDocument } }) {
      // simple cache insert for the MyDocuments list
      cache.modify({
        fields: {
          myDocuments(existing = { items: [] }) {
            return { ...existing, items: [createDocument, ...existing.items] };
          }
        }
      });
    }
  });

  return (
    <button
      disabled={loading}
      onClick={() => createDocument({ variables: { title: 'New doc', content: '' } })}
    >
      Create
    </button>
  );
}
```

Subscription with `useSubscription`:

```jsx
import { useSubscription } from '@apollo/client';
import { SECTION_UPDATED } from 'lib/graphql';

function SectionUpdates({ documentId }) {
  const { data } = useSubscription(SECTION_UPDATED, { variables: { documentId } });

  // `data.sectionUpdated` contains the latest section payload — integrate with local state or cache
  return null; // UI handled elsewhere
}
```

---

## 2) Programmatic usage with Apollo Client (scripts or handlers)

```js
import { createApolloClient } from 'lib/apollo';
import { GET_DOCUMENT, CREATE_DOCUMENT } from 'lib/graphql';

const client = createApolloClient(/* token */ null);

// Query
const res = await client.query({ query: GET_DOCUMENT, variables: { id: 'document-id' } });
console.log(res.data.document);

// Mutation
const m = await client.mutate({ mutation: CREATE_DOCUMENT, variables: { title: 'API doc', content: '' } });
console.log(m.data.createDocument);
```

Notes:
- `createApolloClient(token)` honors auth headers and will use WS links in the browser for subscriptions.

---

## 3) Direct fetch to GraphQL HTTP endpoint (simple scripts)

```js
const HTTP_URL = process.env.NEXT_PUBLIC_GRAPHQL_HTTP || 'http://localhost:4000/graphql';
const token = '...';

const r = await fetch(HTTP_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  },
  body: JSON.stringify({
    query: `query GetDocument($id: ID!) { document(id: $id) { id title } }`,
    variables: { id: 'document-id' }
  })
});
const json = await r.json();
console.log(json.data.document);
```

---

## 4) Subscriptions using `graphql-ws` directly (node/browser)

```js
import { createClient } from 'graphql-ws';

const WS_URL = process.env.NEXT_PUBLIC_GRAPHQL_WS || 'ws://localhost:4000/graphql';
const token = '...';

const client = createClient({ url: WS_URL, connectionParams: token ? { Authorization: `Bearer ${token}` } : {} });

client.subscribe(
  {
    query: `subscription OnCommentAdded($sectionId: ID!) { commentAdded(sectionId: $sectionId) { id content author { id name } } }`,
    variables: { sectionId: 'section-id' }
  },
  {
    next: (data) => console.log('comment', data),
    error: (err) => console.error(err),
    complete: () => console.log('completed')
  }
);

// call the returned cleanup (if used) or hold the client reference to later dispose
```

---

## Quick tips
- Use the React hooks (`useQuery`, `useMutation`, `useSubscription`) inside client components for automatic lifecycle and cache integration.
- Use `createApolloClient` for programmatic requests (scripts, server handlers) — this matches the app's authorization header behavior.
- For subscriptions outside React, `graphql-ws`'s `createClient` is lightweight and works both in Node and browser environments.

---

File created as an examples reference for contributors.
