import { useAuth0 } from "@auth0/auth0-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { UserCircle } from "lucide-react";

interface Auth0AuthenticationProps {
  children: React.ReactNode;
}

export function Auth0Authentication({ children }: Auth0AuthenticationProps) {
  const {
    isLoading,
    isAuthenticated,
    error,
    loginWithRedirect,
    logout,
    user,
  } = useAuth0();

  const signup = () =>
    loginWithRedirect({ authorizationParams: { screen_hint: "signup" } });

  const auth0Logout = () =>
    logout({ logoutParams: { returnTo: window.location.origin } });

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-background">
        <Spinner className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-background text-red-500">
        <p>Error: {error.message}</p>
        <Button onClick={() => loginWithRedirect()} className="mt-4">
          Try Login Again
        </Button>
      </div>
    );
  }

  return isAuthenticated ? (
    <>
      {children}
    </>
  ) : (
    <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-background space-y-4 text-center">
      <h1 className="text-4xl font-bold text-primary">Welcome to StudyDino</h1>
      <p className="text-lg text-muted-foreground">Please log in or sign up to continue.</p>
      <div className="flex space-x-4">
        <Button onClick={signup} size="lg">
          Sign Up
        </Button>
        <Button onClick={() => loginWithRedirect()} size="lg" variant="secondary">
          Log In
        </Button>
      </div>
    </div>
  );
}
