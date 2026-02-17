import { SignIn } from "@clerk/clerk-react";

export default function AuthPage() {
  return (
    <div className="min-h-screen bg-obsidian-bg flex items-center justify-center p-4">
      <SignIn
        appearance={{ variables: { colorPrimary: "#7f6df2" } }}
        forceRedirectUrl={window.location.origin + "/"}
      />
    </div>
  );
}
