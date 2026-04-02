import AuthScreen from "@/components/AuthScreen";

export const metadata = {
  title: "Auth | SyncNote"
};

export default function AuthPage() {
  return <AuthScreen mode="login" lockMode={false} />;
}
