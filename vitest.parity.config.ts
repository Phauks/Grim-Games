/**
 * The parity run (M57, /mnt/project-files/engine-audit/engine-parity-audit.md): the rules tests
 * again, with every official character played as a custom one. Run by `npm run check:parity`,
 * which compares the failures with the shrink-only list in
 * src/lib/core/testing/parity/todo.json. Never part of `vitest run`: failures are expected.
 *
 * - `GRIM_PARITY` makes committed-data.ts hand out each official character with no edition and
 *   a night sheet that lists no character (a custom character has no place on TPI's sheet).
 *   Every character already carries its rules block, so there is no official file to fall
 *   back on in either run.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		name: 'parity',
		environment: 'node',
		include: [
			'src/lib/core/rules-tests/characters/**/*.test.ts',
			'src/lib/core/rules-tests/jinxes/**/*.test.ts'
		],
		isolate: false,
		expect: { requireAssertions: true },
		env: { GRIM_PARITY: '1' }
	}
});
