import { describe, expect, it } from 'vitest';
import { scenario } from '#lib/core/testing/scenario.ts';
import { replay } from './log.ts';
import { toSavedGame } from './persistence.ts';
import { sharedSave } from './shared-save.ts';

// Share grim's choices (Trevor, 2026-11-15: "we don't always want to share everything").
describe('sharedSave', () => {
	const played = scenario(['chef', 'empath', 'imp'])
		.do((at) => ({
			type: 'SetSeatNote',
			seatId: at.seat('chef'),
			title: 'Claim',
			text: 'Says Chef 1',
			hidden: false
		}))
		.do({ type: 'SetGameNote', title: 'Plan', text: 'Bluff the Empath', hidden: false })
		.do({ type: 'SetBluffs', set: 0, characterIds: ['empath', 'chef'] })
		.dies('empath');
	const saved = toSavedGame(played.session, 0);
	const everything = { history: true, seatNotes: true, gameNotes: true, bluffs: true };

	it('sends the whole game when everything is chosen', () => {
		expect(sharedSave(saved, everything).log).toEqual(saved.log);
	});

	it('leaves the notes out of the grimoire and its history', () => {
		const sent = sharedSave(saved, { ...everything, seatNotes: false, gameNotes: false });
		const game = replay(sent.log);
		expect(game.seats[played.seat('chef')].notes ?? []).toEqual([]);
		expect(game.notes ?? []).toEqual([]);
		const types = sent.log.entries.flatMap((e) => e.events.map((ev) => ev.type));
		expect(types).not.toContain('SeatNoteSaved');
		expect(types).not.toContain('GameNoteSet');
		// Each other change is still there to step through.
		expect(game.seats[played.seat('empath')].dead).toBe(true);
		expect(sent.log.entries.length).toBe(saved.log.entries.length - 2);
	});

	// Trevor, 2026-11-16: "you should be able to change what got shared when you share grim".
	it('leaves the Demon bluffs out unless chosen', () => {
		expect(replay(sharedSave(saved, everything).log).bluffs).toEqual([['empath', 'chef']]);
		const sent = sharedSave(saved, { ...everything, bluffs: false });
		expect(replay(sent.log).bluffs ?? []).toEqual([]);
		expect(sent.log.entries.length).toBe(saved.log.entries.length - 1);
	});

	it('keeps one choice of notes without the other', () => {
		const game = replay(sharedSave(saved, { ...everything, gameNotes: false }).log);
		expect(game.seats[played.seat('chef')].notes?.map((n) => n.text)).toEqual(['Says Chef 1']);
		expect(game.notes ?? []).toEqual([]);
	});

	it('without history sends only how the game ended', () => {
		const sent = sharedSave(saved, { ...everything, history: false });
		expect(sent.log.entries).toHaveLength(1);
		expect(sent.log.cursor).toBe(1);
		expect(replay(sent.log)).toEqual(replay(saved.log));
	});
});
