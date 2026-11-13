import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc', '**/coverage', '**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['**/*.ts', '**/*.js', '**/*.mjs', '**/*.cjs', '**/*.cts', '**/*.mts'],
    rules: {
      // Frontières entre projets (voir les `tags` de chaque project.json) :
      // - le front ne voit que les types partagés ;
      // - le domaine ne dépend ni de Discord, ni du front, ni de l'API ;
      // - l'API et le bot ne se connaissent pas, ils passent par le domaine ;
      // - la persistance (`database`) implémente les ports du domaine ; seule l'app la câble.
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [String.raw`^.*/eslint(\.base)?\.config\.[cm]?[jt]s$`],
          depConstraints: [
            { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:shared'] },
            {
              sourceTag: 'scope:api-app',
              onlyDependOnLibsWithTags: ['scope:api', 'scope:bot', 'scope:database', 'scope:domain', 'scope:shared'],
            },
            { sourceTag: 'scope:database', onlyDependOnLibsWithTags: ['scope:domain', 'scope:shared'] },
            { sourceTag: 'scope:api', onlyDependOnLibsWithTags: ['scope:domain', 'scope:shared'] },
            { sourceTag: 'scope:bot', onlyDependOnLibsWithTags: ['scope:domain', 'scope:shared'] },
            {
              sourceTag: 'scope:domain',
              onlyDependOnLibsWithTags: ['scope:shared'],
              bannedExternalImports: ['discord.js', '@discordjs/*', '@angular/*'],
            },
            {
              sourceTag: 'scope:shared',
              onlyDependOnLibsWithTags: [],
              bannedExternalImports: ['discord.js', '@discordjs/*', '@angular/*', '@nestjs/*', 'typeorm'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.cts', '**/*.mts'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
];
