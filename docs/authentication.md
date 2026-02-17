# Authentication

## Overview

mrkdwn.me uses [Convex Auth](https://labs.convex.dev/auth) (`@convex-dev/auth`) for authentication, supporting both email/password credentials and Google OAuth. All backend operations require authentication — unauthenticated users are shown a sign-in page.

## Providers

### Email / Password

- Users can **sign up** with an email and password, or **sign in** with existing credentials.
- The sign-up flow is selected via a toggle on the auth page; the default view is "Sign In".
- Implemented via the `Password` provider from `@convex-dev/auth/providers/Password`.

### Google OAuth

- Users can authenticate with their Google account in a single click.
- Implemented via the `Google` provider from `@auth/core/providers/google`.
- OAuth callback routes are registered automatically in `convex/http.ts`.

## Architecture

### Backend Configuration

**`convex/auth.ts`**

```typescript
import Google from "@auth/core/providers/google";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password, Google],
});
```

- Exports `auth` (for session verification in queries/mutations), `signIn`, `signOut`, and `store`.
- The `auth` tables (users, sessions, accounts, etc.) are automatically added to the Convex schema via `authTables` in `convex/schema.ts`.

**`convex/auth.config.ts`**

```typescript
export default {
  providers: [
    { domain: "https://accounts.google.com", applicationID: "google" },
  ],
};
```

- Configures the Google OAuth domain and application identifier.

**`convex/http.ts`**

```typescript
const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```

- Registers OAuth callback HTTP routes required by the Google provider.

### Frontend Integration

**`src/main.tsx`**

```tsx
<ConvexAuthProvider client={convex}>
  <BrowserRouter>
    <App />
  </BrowserRouter>
</ConvexAuthProvider>
```

- The `ConvexAuthProvider` wraps the entire application, providing auth state to all components.

**`src/App.tsx`**

```tsx
const { isAuthenticated, isLoading } = useConvexAuth();

if (isLoading) return <LoadingScreen />;
if (!isAuthenticated) return <AuthPage />;
return <VaultSelector />;
```

- Uses the `useConvexAuth()` hook to determine auth status.
- Shows a loading spinner during session check.
- Redirects unauthenticated users to `AuthPage`.
- Authenticated users proceed to `VaultSelector`.

## Auth Page UI

**File:** `src/components/auth/AuthPage.tsx`

### Layout

- Centered card on a dark background (`bg-obsidian-bg`).
- Application branding with the mrkdwn.me logo and tagline.
- Toggle between "Sign In" and "Sign Up" modes via a text link.

### Sign In / Sign Up Form

| Field | Type | Validation |
|-------|------|-----------|
| Email | `<input type="email">` | Required |
| Password | `<input type="password">` | Required |

- Submit triggers `signIn("password", formData)` with a `flow` field set to `"signUp"` or `"signIn"`.
- Error handling: catches auth errors and displays a message (e.g., "Could not sign in. Check your credentials.").

### Google Sign-In

- A separate button styled with a Google icon (SVG).
- Triggers `signIn("google")`, which redirects to the Google consent screen.
- On success, the OAuth callback redirects back and the session is established.

## Authorization

All backend queries and mutations enforce authentication:

```typescript
const userId = await auth.getUserId(ctx);
if (!userId) throw new Error("Not authenticated");
```

- Every Convex function checks for a valid session via `auth.getUserId(ctx)`.
- Throws immediately if the session is invalid or expired.

### Data Isolation

- **Vaults** are filtered by `userId` — users can only see and modify their own vaults.
- **Folders and Notes** are accessed through vaults, inheriting the vault's ownership check.
- There is no shared/collaborative access model — each user's data is fully isolated.

## Session Lifecycle

1. **Sign Up**: User submits email + password → account created in Convex `users` table → session token issued → client authenticated.
2. **Sign In**: User submits credentials → validated against stored account → session token issued → client authenticated.
3. **OAuth**: User clicks Google → redirected to Google consent → callback to Convex HTTP route → account linked/created → session token issued → client authenticated.
4. **Session Persistence**: Convex Auth manages session tokens; the `ConvexAuthProvider` restores sessions across page reloads.
5. **Sign Out**: User can sign out (mechanism available via `useAuthActions().signOut()`), destroying the session.

## Security Considerations

- Passwords are hashed and managed by the Convex Auth Password provider (server-side).
- OAuth tokens are handled server-side through Convex HTTP routes — no client-side token exposure.
- All API calls require a valid session token; there are no public/unauthenticated endpoints for data access.
