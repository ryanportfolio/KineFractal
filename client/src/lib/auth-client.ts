// Better Auth browser client (P2 accounts). Same-origin — the server mounts
// the auth handler at /api/auth/*.
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

export const { useSession, signIn, signUp, signOut } = authClient;
export { csrfFetch } from "./csrf-fetch";
