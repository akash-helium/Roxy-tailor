export const LOCAL_SESSION_KEY = 'tailor-local-session';

export const DEFAULT_LOGIN_ID = 'admin';
export const DEFAULT_PASSWORD = 'tailor123';

export const DEFAULT_AUTH_EMAIL = 'admin@example.com';

export const LOCAL_USER = {
  id: 'local-admin',
  email: DEFAULT_AUTH_EMAIL,
  user_metadata: { login_id: DEFAULT_LOGIN_ID, display_name: 'Shop Admin' },
};

export function loginIdToEmail(loginId: string) {
  const id = loginId.trim().toLowerCase();
  if (id === DEFAULT_LOGIN_ID) return DEFAULT_AUTH_EMAIL;
  return `${id}@example.com`;
}

export function isDefaultCredentials(loginId: string, password: string) {
  return loginId.trim().toLowerCase() === DEFAULT_LOGIN_ID && password === DEFAULT_PASSWORD;
}

export function formatLoginError(message?: string | null) {
  const text = (message ?? '').toLowerCase();
  if (
    !message ||
    text.includes('invalid login') ||
    text.includes('invalid credentials') ||
    text.includes('invalid_credentials') ||
    text.includes('wrong password')
  ) {
    return 'Incorrect password';
  }
  return message;
}

export function setLocalSession() {
  localStorage.setItem(
    LOCAL_SESSION_KEY,
    JSON.stringify({ loginId: DEFAULT_LOGIN_ID, at: Date.now() }),
  );
}

export function clearLocalSession() {
  localStorage.removeItem(LOCAL_SESSION_KEY);
}

export function hasLocalSession() {
  return Boolean(localStorage.getItem(LOCAL_SESSION_KEY));
}

export function getAccessToken(session: { access_token: string } | null) {
  return session?.access_token ?? null;
}
