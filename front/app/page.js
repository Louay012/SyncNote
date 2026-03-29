"use client";

import {
  ApolloProvider,
  useMutation,
  useQuery,
  useSubscription
} from "@apollo/client";
import { useEffect, useMemo, useState } from "react";
import CommentsPane from "@/components/CommentsPane";
import DocumentList from "@/components/DocumentList";
import EditorPane from "@/components/EditorPane";
import TokenPanel from "@/components/TokenPanel";
import { createApolloClient } from "@/lib/apollo";
import {
  ADD_COMMENT,
  COMMENT_ADDED,
  CREATE_DOCUMENT,
  DOCUMENT_UPDATED,
  GET_DOCUMENT,
  GET_MY_DOCUMENTS,
  GET_SHARED_DOCUMENTS,
  UPDATE_DOCUMENT
} from "@/lib/graphql";

function Workspace() {
  const [token, setToken] = useState("");
  const [activeId, setActiveId] = useState(null);
  const client = useMemo(() => createApolloClient(token), [token]);

  useEffect(() => {
    const saved = window.localStorage.getItem("syncnote-token");
    if (saved) {
      setToken(saved);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem("syncnote-token", token);
  }, [token]);

  return (
    <ApolloProvider client={client}>
      <WorkspaceContent
        token={token}
        setToken={setToken}
        activeId={activeId}
        setActiveId={setActiveId}
      />
    </ApolloProvider>
  );
}

function WorkspaceContent({ token, setToken, activeId, setActiveId }) {
  const { data: myDocsData, refetch: refetchMine } = useQuery(GET_MY_DOCUMENTS, {
    skip: !token,
    fetchPolicy: "cache-and-network"
  });

  const { data: sharedDocsData, refetch: refetchShared } = useQuery(
    GET_SHARED_DOCUMENTS,
    {
      skip: !token,
      fetchPolicy: "cache-and-network"
    }
  );

  const {
    data: docData,
    loading: loadingDoc,
    refetch: refetchDoc
  } = useQuery(GET_DOCUMENT, {
    variables: { id: activeId },
    skip: !token || !activeId,
    fetchPolicy: "cache-and-network"
  });

  const [createDocument] = useMutation(CREATE_DOCUMENT);
  const [updateDocument, { loading: savingDoc }] = useMutation(UPDATE_DOCUMENT);
  const [addComment, { loading: postingComment }] = useMutation(ADD_COMMENT);

  const myDocs = myDocsData?.myDocuments || [];
  const sharedDocs = sharedDocsData?.sharedWithMeDocuments || [];
  const activeDoc = docData?.document || null;

  useEffect(() => {
    if (!activeId && myDocs.length > 0) {
      setActiveId(myDocs[0].id);
      return;
    }

    if (!activeId && sharedDocs.length > 0) {
      setActiveId(sharedDocs[0].id);
    }
  }, [myDocs, sharedDocs, activeId, setActiveId]);

  useSubscription(DOCUMENT_UPDATED, {
    skip: !token || !activeId,
    variables: { documentId: activeId },
    onData: () => {
      refetchDoc();
      refetchMine();
      refetchShared();
    }
  });

  useSubscription(COMMENT_ADDED, {
    skip: !token || !activeId,
    variables: { documentId: activeId },
    onData: () => {
      refetchDoc();
    }
  });

  async function handleCreate() {
    const title = window.prompt("Document title");
    if (!title || !title.trim()) {
      return;
    }

    const result = await createDocument({
      variables: { title: title.trim(), content: "" }
    });

    const id = result.data?.createDocument?.id;
    await Promise.all([refetchMine(), refetchShared()]);
    if (id) {
      setActiveId(id);
    }
  }

  async function handleSave(nextTitle, nextContent) {
    if (!activeId) {
      return;
    }

    await updateDocument({
      variables: {
        id: activeId,
        title: nextTitle,
        content: nextContent
      }
    });

    await Promise.all([refetchDoc(), refetchMine(), refetchShared()]);
  }

  async function handleAddComment(text) {
    if (!activeId) {
      return;
    }

    await addComment({
      variables: {
        documentId: activeId,
        text
      }
    });

    await refetchDoc();
  }

  return (
    <main className="shell">
      <header className="hero">
        <p className="badge">SYNCNOTE / LIVE COLLAB</p>
        <h1>Shape shared documents together, in real time.</h1>
      </header>

      <TokenPanel token={token} onChange={setToken} />

      {!token ? (
        <section className="panel gated">
          <h2>Token needed</h2>
          <p>
            Add a JWT token to start. Auth screens can be added next when you are
            ready.
          </p>
        </section>
      ) : null}

      <section className="workspace-grid">
        <DocumentList
          myDocs={myDocs}
          sharedDocs={sharedDocs}
          activeId={activeId}
          onSelect={setActiveId}
          onCreate={handleCreate}
        />

        <EditorPane
          document={activeDoc}
          onSave={handleSave}
          saving={savingDoc || loadingDoc}
        />

        <CommentsPane
          comments={activeDoc?.comments || []}
          onAdd={handleAddComment}
          loading={postingComment}
          disabled={!activeId}
        />
      </section>
    </main>
  );
}

export default function Page() {
  return <Workspace />;
}
