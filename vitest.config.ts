import { defineConfig } from 'vitest/config';

/** ブラウザE2EはPlaywright側で実行し、Vitestの対象から除外する。 */
export default defineConfig({
 test: {
  include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
 },
});
