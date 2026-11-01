/**
 * A death caused by an ability a player's own character gives them without a token
 * (`givesAbility` to `self`, `deathCause.kind: gained-ability`), M15i. The Amnesiac's ability is
 * whatever the Storyteller chose (https://wiki.bloodontheclocktower.com/Amnesiac): a death it
 * causes is the Amnesiac's, and once that ability is picked in the seat's menu it is offered
 * only where that ability could have killed.
 */
import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { validDeathCauses } from './death-causes.ts';

// Seating: Ana Amnesiac, Ben Imp, Cat Chef, Dan Empath.
const game = () => scenario(['amnesiac', 'imp', 'chef', 'empath']);
const holding = (characterId: string) =>
	game().do((s) => ({
		type: 'SetHeldAbility',
		seatId: s.seat('amnesiac'),
		via: 'amnesiac',
		characterId
	}));
const amnesiac = (s: ReturnType<typeof game>, victim: string) =>
	validDeathCauses(s.game, s.seat(victim), s.characters).find((c) => c.cause === 'amnesiac');

describe('death cause of a held ability', () => {
	it('offers the Amnesiac for any death while its ability is not recorded', () => {
		const s = game();
		expect(amnesiac(s, 'chef')).toMatchObject({ kind: 'gained-ability' });
		expect(amnesiac(s, 'chef')?.gained).toBeUndefined();
	});

	it('records a death by the ability it holds as the Amnesiac’s, shown with that ability', () => {
		const s = holding('slayer');
		expect(amnesiac(s, 'imp')).toMatchObject({ kind: 'gained-ability', gained: 'slayer' });
		// The Slayer's shot kills only a player who registers as the Demon.
		expect(amnesiac(s, 'chef')).toBeUndefined();
	});

	it('offers it for its own death only, when the held ability only kills its holder', () => {
		const s = holding('tinker');
		expect(amnesiac(s, 'amnesiac')).toMatchObject({ gained: 'tinker' });
		expect(amnesiac(s, 'chef')).toBeUndefined();
	});

	it('leaves the Amnesiac out when the ability it holds never kills', () => {
		const s = holding('empath');
		expect(amnesiac(s, 'chef')).toBeUndefined();
		expect(amnesiac(s, 'imp')).toBeUndefined();
	});

	it('still offers it, flagged, while the Amnesiac is poisoned now', () => {
		// It may have killed before it was poisoned.
		const s = holding('slayer').poisoned('amnesiac');
		expect(amnesiac(s, 'imp')).toMatchObject({
			gained: 'slayer',
			flags: [{ code: 'impaired', seatIds: [s.seat('amnesiac')] }]
		});
	});
});
