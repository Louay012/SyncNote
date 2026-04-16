"use client";

import React from "react";
import { ApolloProvider, useQuery, gql } from "@apollo/client";
import { createApolloClient } from "@/lib/apollo";
import Diary from "@/components/diary/DiaryLayout";
import EditorPage from "@/components/EditorPage";

const LIST_DIARY_ENTRIES = gql`
  query ListDiaryEntries($documentId: ID!) {
    listDiaryEntries(documentId: $documentId) {
      id
    }
  }
`;

function DocumentDecider({ documentId }) {
  const { data, loading } = useQuery(LIST_DIARY_ENTRIES, {
    variables: { documentId },
    skip: !documentId,
    fetchPolicy: "network-only"
  });

  if (loading) {
    return (
      <main className="auth-shell">
        <section className="panel notice-panel">
          <p>Loading document...</p>
        </section>
      </main>
    );
  }

  const isDiary = data && Array.isArray(data.listDiaryEntries) && data.listDiaryEntries.length > 0;

  if (isDiary) {
    return <Diary documentId={documentId} />;
  }

  return <EditorPage documentId={documentId} />;
}

export default function DocumentEditorRoute({ params }) {
  const client = createApolloClient("");
  return (
    <ApolloProvider client={client}>
      <DocumentDecider documentId={params?.id} />
    </ApolloProvider>
  );
}
