import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 120000,
    hookTimeout: 120000,
    // Fast password hashing in tests only. Production default stays 12.
    // EMAIL_DISABLED forces the stub mailer (VITEST=true already does too).
    env: { BCRYPT_ROUNDS: '4', EMAIL_DISABLED: 'true' },
  },
});
