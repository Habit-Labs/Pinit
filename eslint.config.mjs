// Mirrors Obsidian's automated plugin review as closely as possible locally.
// Caveat: the scanner remaps severities (most rules → warn, ~14 escalated to
// error) and adds typed no-unsafe-* / require-await rules not in `recommended`.
// The community.obsidian.md dashboard preview scan is the exact final gate.
import tsparser from '@typescript-eslint/parser';
import { defineConfig } from 'eslint/config';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default defineConfig([
	...obsidianmd.configs.recommended,
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: './tsconfig.json' },
		},
		rules: {
			// TypeScript already checks undefined identifiers; the review scanner
			// also runs with no-undef disabled. Ambient types trip it otherwise.
			'no-undef': 'off',
		},
	},
]);
