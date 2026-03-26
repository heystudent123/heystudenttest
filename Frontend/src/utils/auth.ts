// Deprecated: tokens are no longer stored in browser storage.
export const getToken = (): string | null => {
  return null;
};

// Deprecated no-op.
export const setToken = (token: string): void => {
  void token;
};

// Deprecated no-op.
export const removeToken = (): void => {
  return;
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return !!getToken();
};
