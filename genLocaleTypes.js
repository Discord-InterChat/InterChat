// @ts-check
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { parse } from 'yaml';
import { fileURLToPath } from 'url';

// Helper function to get the current directory name in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Function to recursively generate type definitions from the translation keys
function generateTypes(obj, path = '') {
  const keys = Object.keys(obj);
  return keys.map(key => {
    const fullPath = path ? `${path}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      return generateTypes(obj[key], fullPath);
    }
    return `'${fullPath}'`;
  }).flat();
}

// Read the YAML file
const filePath = resolve(__dirname, 'locales/src/locales/en.yml');
const file = readFileSync(filePath, 'utf8');

// Parse the YAML content
const data = parse(file);

// Generate type definitions
const typeDefinitions = generateTypes(data);

// Create the .d.ts content
const dtsContent = `export type TranslationKey = ${typeDefinitions.join(' | ')};\n`;

// Write the .d.ts file
const outputFilePath = resolve(__dirname, 'src/typings/en.d.ts');
writeFileSync(outputFilePath, dtsContent);

console.log(`Type definitions for locales written to ${outputFilePath}`);
