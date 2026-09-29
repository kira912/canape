/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  moduleNameMapper: {
    "^@canape/shared$": "<rootDir>/../../packages/shared/src/index.ts",
    "^@react-native-async-storage/async-storage$":
      "<rootDir>/../../node_modules/@react-native-async-storage/async-storage/jest/async-storage-mock",
  },
};
