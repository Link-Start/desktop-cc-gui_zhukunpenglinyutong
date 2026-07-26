module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    'react/react-in-jsx-scope': 'off',
    'react/jsx-uses-react': 'off',
    'react/no-unescaped-entities': 'off',
    'react/prop-types': 'off',
    'react/display-name': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        paths: [
          {
            name: 'lucide-react',
            message:
              "Import icons from 'lucide-react/dist/esm/icons/{kebab-name}' to enable tree-shaking. Type imports (LucideIcon, LucideProps) are allowed via `import type`.",
            allowTypeImports: true,
          },
        ],
      },
    ],
    'no-restricted-globals': [
      'error',
      {
        name: 'alert',
        message: 'Use the application-owned Error Toast or dialog instead of native alert().',
      },
    ],
    'no-restricted-properties': [
      'error',
      {
        object: 'window',
        property: 'alert',
        message:
          'Use the application-owned Error Toast or dialog instead of window.alert().',
      },
    ],
  },
  overrides: [
    {
      files: ['**/*.ts', '**/*.tsx'],
    },
    {
      files: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**/*.ts', '**/__tests__/**/*.tsx'],
      rules: {
        'no-restricted-globals': 'off',
        'no-restricted-properties': 'off',
      },
    },
    {
      files: [
        'src/app-shell.tsx',
        'src/app-shell-parts/renderAppShell.tsx',
        'src/app-shell-parts/useAppShellLayoutNodesSection.tsx',
        'src/app-shell-parts/useAppShellSearchAndComposerSection.ts',
        'src/app-shell-parts/useAppShellSections.ts',
        'src/features/git-history/components/git-history-panel/components/GitHistoryPanelDialogs.tsx',
        'src/features/git-history/components/git-history-panel/components/GitHistoryPanelImpl.tsx',
        'src/features/git-history/components/git-history-panel/components/GitHistoryPanelPickers.tsx',
        'src/features/git-history/components/git-history-panel/components/GitHistoryPanelView.tsx',
        'src/features/git-history/components/git-history-panel/hooks/useGitHistoryPanelInteractions.tsx',
        'src/features/settings/components/SettingsView.tsx',
        'src/features/settings/components/settings-view/sections/CodexSection.tsx',
        'src/features/spec/components/spec-hub/presentational/SpecHubPresentationalImpl.tsx',
      ],
      rules: {
        '@typescript-eslint/ban-ts-comment': 'off',
      },
    },
    {
      files: [
        'src/app-shell.tsx',
        'src/app-shell-parts/renderAppShell.tsx',
        'src/app-shell-parts/useAppShellLayoutNodesSection.tsx',
        'src/app-shell-parts/useAppShellSearchAndComposerSection.ts',
        'src/app-shell-parts/useAppShellSections.ts',
        'src/features/git-history/components/git-history-panel/components/GitHistoryPanelDialogs.tsx',
        'src/features/git-history/components/git-history-panel/components/GitHistoryPanelImpl.tsx',
        'src/features/git-history/components/git-history-panel/components/GitHistoryPanelView.tsx',
        'src/features/git-history/components/git-history-panel/hooks/useGitHistoryPanelInteractions.tsx',
        'src/features/settings/components/SettingsView.tsx',
      ],
      rules: {
        '@typescript-eslint/no-unused-vars': 'off',
      },
    },
    {
      files: ['src/features/spec/components/spec-hub/presentational/SpecHubPresentationalImpl.tsx'],
      rules: {
        'no-empty': 'off',
      },
    },
  ],
};
