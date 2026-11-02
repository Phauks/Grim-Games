/**
 * Counting pairs of neighbours when a player may misregister: they may register differently
 * for each pair they are part of, since each pair is detected on its own.
 * - https://wiki.bloodontheclocktower.com/Chef (Example 4: a Recluse between the Imp and the
 *   Poisoner counts as evil for one pair and good for the other, so the Chef learns 1)
 * - https://wiki.bloodontheclocktower.com/Recluse and /Spy (the Storyteller chooses each
 *   time the alignment is detected, even differently in the same night)
 * - https://wiki.bloodontheclocktower.com/Empath (two neighbours, each counted once: one
 *   registration each, so nothing changes there)
 */
import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { abnormalCauses, infoPicker, isAllowed, isTruthful } from '../night-info.ts';

describe('Chef: a misregistering player in two pairs', () => {
	it('Example 4: a Recluse between the Imp and the Poisoner allows 0, 1 or 2', () => {
		const s = scenario(['chef', 'imp', 'recluse', 'poisoner', 'monk']);
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		expect(picker.range).toEqual({ truth: 0, possible: [0, 1, 2] });
		expect(isTruthful(picker, { seats: [], number: 0 })).toBe(true);
		expect(isAllowed(picker, { seats: [], number: 1 })).toBe(true);
		expect(isTruthful(picker, { seats: [], number: 1 })).toBe(false);
		expect(isAllowed(picker, { seats: [], number: 3 })).toBe(false);
	});

	it('the mixed answer relies on the Recluse misregistering, for the Mathematician', () => {
		const s = scenario(['chef', 'imp', 'recluse', 'poisoner', 'monk']);
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		const one = picker.options.find((o) => o.number === 1);
		expect(one?.registered).toEqual([s.seat('recluse')]);
		expect(abnormalCauses(picker, { seats: [], number: 1 })).not.toEqual([]);
	});

	it('a Spy between the Imp and a good player allows 0 or 1', () => {
		// The Spy page's example: the Spy counts as evil for the Chef.
		const s = scenario(['chef', 'imp', 'spy', 'monk', 'empath']);
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		expect(picker.range).toEqual({ truth: 1, possible: [0, 1] });
	});

	it('a Spy between two evil players allows 0, 1 or 2', () => {
		const s = scenario(['chef', 'imp', 'spy', 'poisoner', 'monk']);
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		expect(picker.range).toEqual({ truth: 2, possible: [0, 1, 2] });
	});

	it('a Recluse with one evil neighbour still allows only 0 or 1', () => {
		const s = scenario(['chef', 'imp', 'recluse', 'monk', 'empath']);
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		expect(picker.range).toEqual({ truth: 0, possible: [0, 1] });
	});

	it('a poisoned Recluse registers truly in every pair', () => {
		const s = scenario(['chef', 'imp', 'recluse', 'poisoner', 'monk']).poisoned('recluse');
		const picker = infoPicker(s.game, s.seat('chef'), 'chef', s.characters)!;
		expect(picker.range).toEqual({ truth: 0, possible: [0] });
	});
});

describe('Empath: each neighbour counted once', () => {
	it('a Recluse beside the Imp allows 1 or 2, as before', () => {
		const s = scenario(['empath', 'recluse', 'monk', 'chef', 'imp']);
		const picker = infoPicker(s.game, s.seat('empath'), 'empath', s.characters)!;
		expect(picker.range).toEqual({ truth: 1, possible: [1, 2] });
	});
});
