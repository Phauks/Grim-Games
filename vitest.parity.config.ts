/**
 * The parity run (M57, /mnt/project-files/engine-audit/engine-parity-audit.md): the rules tests
 * again, with every official character played as a custom one. Run by `npm run check:parity`,
 * which compares the failures with the shrink-only list in
 * src/lib/core/testing/parity/todo.json. Never part of `vitest run`: failures are expected.
 *
 * - `GRIM_PARITY` makes committed-data.ts hand out each official character with no edition, its
 *   rules block on the character, and a night sheet that lists no character (a custom
 *   character has no place on TPI's sheet).
 * - `parityPlugin` swaps `data/rules/index.ts` for `testing/parity/official-rules.ts`, so no
 *   rule falls back to the official overlay files.
 */
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';

const real = fileURLToPath(new URL('./src/lib/core/data/rules/index.ts', import.meta.url));
const standIn = fileURLToPath(
	new URL('./src/lib/core/testing/parity/official-rules.ts', import.meta.url)
);
const parityDir = fileURLToPath(new URL('./src/lib/core/testing/parity/', import.meta.url));

function parityPlugin(): Plugin {
	return {
		name: 'grim-parity',
		enforce: 'pre',
		async resolveId(source, importer, options) {
			if (!importer || importer.startsWith(parityDir)) return null;
			if (!/rules\/index\.ts$/.test(source)) return null;
			const resolved = await this.resolve(source, importer, { ...options, skipSelf: true });
			return resolved?.id === real ? standIn : null;
		}
	};
}

export default defineConfig({
	plugins: [parityPlugin()],
	test: {
		name: 'parity',
		environment: 'node',
		include: ['src/lib/core/abilities/**/*.test.ts', 'src/lib/core/jinxes/**/*.test.ts'],
		isolate: false,
		expect: { requireAssertions: true },
		env: { GRIM_PARITY: '1' }
	}
});
