/**
 * Integration tests: the real app against a real Postgres (TEST_DATABASE_URL,
 * whose database name must contain "test" — it is wiped). TMDB is faked.
 * `pnpm --filter @canape/api test:integration`
 */
/** @type {import('jest').Config} */
module.exports = {
  ...require("./jest.config"),
  testRegex: ".*\\.int-spec\\.ts$",
};
