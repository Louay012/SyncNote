import AuthScreen from "@/components/AuthScreen";

export const metadata = {
  title: "Login | SyncNote"
};

export default function LoginPage() {
  return (
    <AuthScreen
      mode="login"
      lockMode={true}
      switchHref="/signup"
      switchLabel="Need an account? Create one"
    />
  );
}
