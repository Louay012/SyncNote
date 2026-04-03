"use client";

import WorkspaceApp from "@/components/WorkspaceApp";

export default function EditorPage({ documentId }) {
  return (
    <WorkspaceApp
      initialDocumentId={documentId}
      shellVariant="editor"
    />
  );
}
