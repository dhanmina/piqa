import { createContext, useContext } from 'react';

export type AuthState = { signedIn: boolean; onboarded: boolean };

const AuthStateContext = createContext<AuthState>({ signedIn: false, onboarded: false });

export const AuthStateProvider = AuthStateContext.Provider;

export function useAuthState(): AuthState {
  return useContext(AuthStateContext);
}
