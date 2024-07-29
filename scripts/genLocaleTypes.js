// @ts-check
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

// Helper function to get the current directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Recursively generate type definitions from the translation data
    @param obj {{ [key: string]: string }} the object with all translation data
    @returns {string[]}
*/
function generateTypes(obj, path = '') {
  const keys = Object.keys(obj);
  /** @type {string[]} */
  const allTypeDefs = [];
  keys.forEach((key) => {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      const idk = generateTypes(obj[key], fullPath);
      return allTypeDefs.push(...idk);
    }

    const regex = /\{([^\}]+)\}/g;
    const variables = [...obj[key].matchAll(regex)].map((match) => `'${match[1]}'`);
    const variablesStr = variables.length !== 0 ? variables.join(' | ') : 'never';

    allTypeDefs.push(`'${fullPath}': ${variablesStr}`);
  });

  return allTypeDefs;
}

// Read the YAML file
const filePath = resolve(__dirname, '..', 'locales/locales/en.yml');
const file = readFileSync(filePath, 'utf8');

// Parse the YAML content
/** @type {{ [key: string]: string }} */
// @ts-expect-error
const data = yaml.load(file);

// Generate type definitions
const typeDefinitions = generateTypes(data);

// Create the .d.ts content
const dtsContent = `export type TranslationKeys = {\n  ${typeDefinitions.join(';\n  ')};\n};\n`;

// Write the .d.ts file
const outputFilePath = resolve(__dirname, '..', 'src/typings/en.d.ts');
writeFileSync(outputFilePath, dtsContent);

console.log(`Type definitions for locales written to ${outputFilePath}`);
