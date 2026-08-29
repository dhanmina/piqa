import { createContext, useContext } from 'react';

export type AuthState = {
  signedIn: boolean;
  onboarded: boolean;
  needsUsername: boolean;
  markOnboarded: () => void;
  markUsernameSet: () => void;
};

const AuthStateContext = createContext<AuthState>({
  signedIn: false,
  onboarded: false,
  needsUsername: false,
  markOnboarded: () => {},
  markUsernameSet: () => {},
});

export const AuthStateProvider = AuthStateContext.Provider;

export function useAuthState(): AuthState {
  return useContext(AuthStateContext);
}
