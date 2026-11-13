// Fait résoudre les alias `@porolympiques/*` (tsconfig.base.json) par Node, pour la CLI TypeORM lancée avec ts-node.
// (Pas de `baseUrl` dans les tsconfig : l'option est dépréciée depuis TypeScript 6.)
const path = require('node:path');
const { register } = require('tsconfig-paths');
const { compilerOptions } = require('../tsconfig.base.json');

register({ baseUrl: path.resolve(__dirname, '..'), paths: compilerOptions.paths });
