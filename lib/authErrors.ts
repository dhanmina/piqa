import type { AuthError } from '@supabase/supabase-js';

export type FormError = { message: string; field?: 'email' | 'password' | 'confirmPassword' };

export function mapAuthError(error: AuthError): FormError {
  if (error.name === 'AuthRetryableFetchError') {
    return { message: "Couldn't connect. Check your connection and try again." };
  }

  switch (error.code) {
    case 'invalid_credentials':
      // Deliberately generic — never reveal whether the email or the password was wrong.
      return { message: 'Incorrect email or password.' };
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return { message: 'Too many attempts. Try again in a minute.' };
    case 'user_already_exists':
    case 'email_exists':
      return { message: 'An account with this email already exists.', field: 'email' };
    case 'weak_password':
      return { message: 'Password must be at least 8 characters.', field: 'password' };
    case 'email_address_invalid':
      return { message: 'Enter a valid email address.', field: 'email' };
    default:
      return { message: error.message };
  }
}
