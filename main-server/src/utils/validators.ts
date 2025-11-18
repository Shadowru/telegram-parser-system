// src/utils/validators.ts
export const isValidUsername = (username: string): boolean => {
  // Telegram username rules: 5-32 characters, alphanumeric and underscores
  const regex = /^[a-zA-Z0-9_]{5,32}$/;
  return regex.test(username);
};

export const isValidEmail = (email: string): boolean => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
};

export const isValidPassword = (password: string): boolean => {
  // At least 8 characters, one uppercase, one lowercase, one number
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password)
  );
};

export const sanitizeUsername = (username: string): string => {
  // Remove @ symbol and convert to lowercase
  return username.replace('@', '').toLowerCase().trim();
};