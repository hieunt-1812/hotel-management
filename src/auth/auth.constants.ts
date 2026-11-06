export const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 7;

export const REFRESH_TOKEN_KEY_PREFIX = 'refresh_';
export const USED_REFRESH_TOKEN_KEY_PREFIX = 'refresh_used_';
export const USER_REFRESH_TOKENS_KEY_PREFIX = 'refresh_user_';

export const INVALID_REFRESH_TOKEN_MESSAGE =
  'Refresh token không hợp lệ hoặc đã hết hạn';
export const REUSED_REFRESH_TOKEN_MESSAGE =
  'Refresh token đã được sử dụng. Vui lòng đăng nhập lại.';
