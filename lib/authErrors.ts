export type FormError = { message: string; field?: 'username' | 'email' | 'password' | 'confirmPassword' };

type AuthLikeError = { name?: string; code?: string; message: string };

export function mapAuthError(error: AuthLikeError): FormError {
  if (error.name === 'AuthRetryableFetchError') {
    return { message: 'Connection failed. Try again.' };
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
      return { message: 'Email already registered.', field: 'email' };
    case 'weak_password':
      return { message: 'Password must be at least 8 characters.', field: 'password' };
    case 'email_address_invalid':
      return { message: 'Enter a valid email address.', field: 'email' };
    case 'otp_expired':
      return { message: 'This code has expired. Request a new one.' };
    default:
      return { message: error.message };
  }
}
