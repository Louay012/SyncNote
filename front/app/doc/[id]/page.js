import EditorPage from "@/components/EditorPage";

export default function DocumentEditorRoute({ params }) {
  return <EditorPage documentId={params?.id} />;
}
