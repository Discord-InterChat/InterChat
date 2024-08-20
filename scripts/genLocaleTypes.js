// @ts-check
import { readFileSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { dirname, resolve } from 'path';
import { createPrinter, factory, NewLineKind, NodeFlags, SyntaxKind } from 'typescript';
import { fileURLToPath } from 'url';
import prettier from 'prettier';

// Helper function to get the current directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Recursively generate type definitions from the translation data
    @param obj {{ [key: string]: string }} the object with all translation data
    @returns {import('typescript').TypeElement[]}
*/
const generateTypes = (obj, path = '') => {
  const keys = Object.keys(obj);
  /** @type {import('typescript').TypeElement[]} */
  const typeDefs = [];
  keys.forEach((key) => {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      typeDefs.push(...generateTypes(obj[key], fullPath));
      return;
    }

    const regex = /{([^}]+)}/g;
    const variables = [...obj[key].matchAll(regex)].map((match) => `'${match[1]}'`);
    const variablesType = variables.length !== 0 ? variables.join(' | ') : 'never';

    typeDefs.push(
      factory.createPropertySignature(
        undefined,
        factory.createStringLiteral(fullPath),
        undefined,
        factory.createTypeReferenceNode(variablesType),
      ),
    );
  });

  return typeDefs;
};

/**
 *
 * @param {string} values
 */
const formatWithPrettier = async (values) => {
  const configFile = await prettier.resolveConfigFile();
  if (!configFile) return values;

  const config = await prettier.resolveConfig(configFile);
  const formatted = await prettier.format(values, { ...config, parser: 'typescript' });

  return formatted;
};

// Read the YAML file
const filePath = resolve(__dirname, '..', 'locales/locales/en.yml');
const file = readFileSync(filePath, 'utf8');

// Parse the YAML content
/** @type {{ [key: string]: string }} */
// @ts-expect-error
const data = yaml.load(file);

// Generate type definitions
const typeDefinitions = generateTypes(data);

// Create the TypeScript type alias
const typeAliasDeclaration = factory.createTypeAliasDeclaration(
  [factory.createModifier(SyntaxKind.ExportKeyword)],
  'TranslationKeys',
  undefined,
  factory.createTypeLiteralNode(typeDefinitions),
);

// Create a source file and add the type alias
const sourceFile = factory.createSourceFile(
  [typeAliasDeclaration],
  factory.createToken(SyntaxKind.EndOfFileToken),
  NodeFlags.None,
);

// Print the TypeScript code to a string
const printer = createPrinter({ newLine: NewLineKind.LineFeed });
const formattedTypes = await formatWithPrettier(printer.printFile(sourceFile));

// Write the .d.ts file
const outputFilePath = resolve(__dirname, '..', 'src/typings/en.d.ts');
writeFileSync(outputFilePath, formattedTypes);

console.log(`Type definitions for locales written to ${outputFilePath}`);
