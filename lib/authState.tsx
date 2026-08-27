import { createContext, useContext } from 'react';

export type AuthState = { signedIn: boolean; onboarded: boolean; markOnboarded: () => void };

const AuthStateContext = createContext<AuthState>({ signedIn: false, onboarded: false, markOnboarded: () => {} });

export const AuthStateProvider = AuthStateContext.Provider;

export function useAuthState(): AuthState {
  return useContext(AuthStateContext);
}
