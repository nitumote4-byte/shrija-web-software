export const MIN_PASSWORD_LENGTH = 10

const COMMON_PASSWORDS = new Set(
  [
    'admin123',
    'smg123',
    'password',
    'password1',
    'password12',
    'password123',
    '1234567890',
    '123456789',
    '12345678',
    'qwerty1234',
    'qwerty123',
    'letmein123',
    'welcome123',
    'shrija123',
    'hallmark123',
    'changeme123',
    'passw0rd12',
  ].map((s) => s.toLowerCase()),
)

export function passwordPolicyError(password: string, username?: string): string | null {
  const value = String(password || '')
  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
  }
  if (value.length > 200) {
    return 'Password is too long'
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) {
    return 'This password is too common. Choose a different one.'
  }
  const user = String(username || '').trim()
  if (user.length >= 3 && value.toLowerCase().includes(user.toLowerCase())) {
    return 'Password must not contain the username'
  }
  return null
}
