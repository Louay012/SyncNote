import AuthScreen from "@/components/AuthScreen";

export const metadata = {
  title: "Sign Up | SyncNote"
};

export default function SignupPage() {
  return (
    <AuthScreen
      mode="register"
      lockMode={true}
      switchHref="/login"
      switchLabel="Already have an account? Log in"
    />
  );
}
