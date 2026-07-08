module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:security/recommended-legacy',
  ],
  ignorePatterns: ['dist', 'node_modules', 'coverage'],
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
  plugins: ['react-refresh', 'security'],
  settings: { react: { version: 'detect' } },
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    // Too noisy for standard bracket notation on known keys
    'security/detect-object-injection': 'off',
    // Allow console.warn/error; use logger.info for informational logs
    'no-console': ['warn', { allow: ['warn', 'error'] }],
  },
};
