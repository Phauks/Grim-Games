import { describe, expect, it } from 'vitest';
import { readWorldCupAnswer } from './world-cup.ts';

describe('readWorldCupAnswer', () => {
	it('reads our stored copy and leaves out anything that is not a script', () => {
		expect(
			readWorldCupAnswer({
				scripts: [
					{ scriptId: 6687, version: '1.0.0', json: [{ id: '_meta' }] },
					{ scriptId: 'x', version: '1', json: [] },
					{ scriptId: 1, version: '1', json: {} }
				]
			})
		).toEqual([{ scriptId: 6687, version: '1.0.0', json: [{ id: '_meta' }] }]);
		expect(readWorldCupAnswer({ error: 'down' })).toBeUndefined();
	});
});
