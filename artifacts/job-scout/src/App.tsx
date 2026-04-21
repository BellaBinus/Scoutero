import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DevRoleProvider } from "@/contexts/dev-role-context";
import { AppLayout } from "@/components/layout/app-layout";

import SearchPage from "@/pages/search";
import CompaniesPage from "@/pages/companies";
import HistoryPage from "@/pages/history";
import SearchDetailsPage from "@/pages/search-details";
import KeywordsPage from "@/pages/keywords";
import JobsPage from "@/pages/jobs";
import OpsLogPage from "@/pages/ops-log";
import NotFound from "@/pages/not-found";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#4d7435",
    colorBackground: "#fffef4",
    colorInputBackground: "#fff",
    colorText: "#2a1f0e",
    colorTextSecondary: "#7a6030",
    colorInputText: "#2a1f0e",
    colorNeutral: "#9a8060",
    borderRadius: "0.75rem",
    fontFamily: "'Inter', sans-serif",
    fontFamilyButtons: "'Inter', sans-serif",
    fontSize: "0.9375rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "rounded-2xl w-full overflow-hidden shadow-lg border border-[#cdb87e]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: "#2a1f0e", fontWeight: "700" },
    headerSubtitle: { color: "#7a6030" },
    socialButtonsBlockButtonText: { color: "#2a1f0e" },
    formFieldLabel: { color: "#5a4020" },
    footerActionLink: { color: "#4d7435", fontWeight: "600" },
    footerActionText: { color: "#7a6030" },
    dividerText: { color: "#9a8060" },
    identityPreviewEditButton: { color: "#4d7435" },
    formFieldSuccessText: { color: "#4d7435" },
    alertText: { color: "#c0392b" },
    socialButtonsBlockButton: "border border-[#cdb87e] hover:bg-[#f5edd0] rounded-xl",
    formButtonPrimary: "bg-[#4d7435] hover:bg-[#3c5c29] text-white font-semibold rounded-xl",
    formFieldInput: "border border-[#cdb87e] rounded-xl bg-white focus:ring-[#4d7435]",
    footerAction: "border-t border-[#cdb87e]",
    dividerLine: "bg-[#cdb87e]",
    otpCodeFieldInput: "border border-[#cdb87e] rounded-lg",
    main: "px-2",
  },
};

function AppRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={SearchPage} />
        <Route path="/companies" component={CompaniesPage} />
        <Route path="/ops-log" component={OpsLogPage} />
        <Route path="/history" component={HistoryPage} />
        <Route path="/history/:id" component={SearchDetailsPage} />
        <Route path="/keywords" component={KeywordsPage} />
        <Route path="/jobs" component={JobsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <AppRouter />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ background: "#fffef4" }}
    >
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
      />
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div
      className="flex min-h-[100dvh] items-center justify-center px-4"
      style={{ background: "#fffef4" }}
    >
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
      />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Scoutero account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Start scouting jobs today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <DevRoleProvider>
            <Switch>
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route component={HomeRedirect} />
            </Switch>
          </DevRoleProvider>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
