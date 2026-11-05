import { describe, expect, it } from 'vitest';
import { compareParity, FILE_FAILED, parityFailures, readVitestJson } from './parity.ts';

describe('parity gate', () => {
	it('counts failing behaviour tests, never the data checks', () => {
		expect(
			parityFailures([
				{ file: 'a.test.ts', name: 'Chef data (roles.json) is a Townsfolk', status: 'failed' },
				{ file: 'a.test.ts', name: 'Chef Example 1', status: 'failed' },
				{ file: 'a.test.ts', name: 'Chef Example 2', status: 'passed' }
			])
		).toEqual(['a.test.ts > Chef Example 1']);
	});

	it('reports new failures and listed tests that pass now', () => {
		expect(compareParity(['x', 'y'], ['y', 'z'])).toEqual({
			added: ['x'],
			fixed: ['z'],
			failing: 2,
			listed: 2
		});
	});

	it('reads a file that failed to load as one failure', () => {
		const results = readVitestJson(
			{
				testResults: [
					{ name: '/repo/src/a.test.ts', status: 'failed', assertionResults: [] },
					{
						name: '/repo/src/b.test.ts',
						status: 'passed',
						assertionResults: [{ fullName: 'B works', status: 'passed' }]
					}
				]
			},
			'/repo'
		);
		expect(results).toEqual([
			{ file: 'src/a.test.ts', name: FILE_FAILED, status: 'failed' },
			{ file: 'src/b.test.ts', name: 'B works', status: 'passed' }
		]);
	});
});
