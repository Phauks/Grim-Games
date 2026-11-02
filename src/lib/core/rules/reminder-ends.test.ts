import { describe, expect, it } from 'vitest';
import type { Character, Script } from '#lib/core/data/types.ts';
import { parseCharacterRules } from '#lib/core/data/character-rules.ts';
import { Issues } from '#lib/core/data/validate.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { scenario, type Scenario } from '#lib/core/testing/scenario.ts';
import { remindersEndingAt } from './reminder-ends.ts';

const data = committedGameData();

/** The labels of `characterId`'s reminders on the board. */
function labelsOf(s: Scenario, characterId: string): string[] {
	return s.game.seating.flatMap((id) =>
		s.game.seats[id].reminders.filter((r) => r.characterId === characterId).map((r) => r.label)
	);
}

describe('reminderEnds', () => {
	it('reads each label with dawn or dusk, and reports the rest', () => {
		const ok = parseCharacterRules({ reminderEnds: { Safe: 'dawn' } }, 'rules', new Issues(), [
			'Safe'
		]);
		expect(ok?.reminderEnds).toEqual({ Safe: 'dawn' });
		const issues = new Issues();
		parseCharacterRules(
			{ reminderEnds: { Safe: 'dawn', Gone: 'dusk', Other: 'noon' } },
			'rules',
			issues,
			['Safe', 'Other']
		);
		expect(issues.list.map((i) => i.split(': ')[0])).toEqual([
			'rules.reminderEnds.Gone',
			'rules.reminderEnds.Other'
		]);
	});

	it('lists the reminders that come off at dawn and at dusk', () => {
		const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner'])
			.reminder('chef', 'monk', 'Safe')
			.poisoned('empath')
			.reminder('imp', 'imp', 'Dead');
		const reminderOf = (seat: string, characterId: string) =>
			s.game.seats[s.seat(seat)].reminders.find((r) => r.characterId === characterId)!.reminderId;
		expect(remindersEndingAt(s.game, 'dawn', s.characters)).toEqual([reminderOf('chef', 'monk')]);
		expect(remindersEndingAt(s.game, 'dusk', s.characters)).toEqual([
			reminderOf('empath', 'poisoner')
		]);
	});

	it('takes dawn reminders off at a new day and dusk ones at dusk', () => {
		const s = scenario(['monk', 'chef', 'imp', 'empath', 'poisoner'])
			.reminder('chef', 'monk', 'Safe')
			.poisoned('empath');
		const day = s.newDay();
		expect(labelsOf(day, 'monk')).toEqual([]);
		expect(labelsOf(day, 'poisoner')).toEqual(['Poisoned']);
		const night = day.dusk();
		expect(labelsOf(night, 'poisoner')).toEqual([]);
		// Dusk with nothing to take off changes nothing.
		expect(night.dusk().session.log).toBe(night.session.log);
	});

	it('leaves every reminder when the Storyteller turns timed reminders off', () => {
		// Settings › Take reminders off on time, off (Trevor, 2026-11-02): New day and Dusk change
		// no tokens, the Flowergirl's swap included.
		const s = scenario(['monk', 'chef', 'imp', 'flowergirl', 'poisoner'])
			.reminder('chef', 'monk', 'Safe')
			.poisoned('chef');
		const day = s.do({ type: 'NewDay', keepReminders: true });
		expect(labelsOf(day, 'monk')).toEqual(['Safe']);
		expect(labelsOf(day, 'flowergirl')).toEqual(labelsOf(s, 'flowergirl'));
		expect(day.game.pastDays).toHaveLength(s.game.pastDays.length + 1);
		// With the setting on, the same dawn changes the Flowergirl's tokens.
		expect(labelsOf(s.newDay(), 'flowergirl')).not.toEqual(labelsOf(s, 'flowergirl'));
		const night = day.do({ type: 'Dusk', keepReminders: true });
		expect(labelsOf(night, 'poisoner')).toEqual(['Poisoned']);
	});

	it('keeps a dawn token a jinx in play reads by day until dusk', () => {
		// https://wiki.bloodontheclocktower.com/Riot#Related_Jinxes: Riot executing the player the
		// Monk protects ends the game, so the Safe stays through the day.
		const script: Script = { entries: ['monk', 'chef', 'riot', 'empath'].map(official) };
		const s = scenario(['monk', 'chef', 'riot', 'empath'], { script }).reminder(
			'chef',
			'monk',
			'Safe'
		);
		expect(labelsOf(s.newDay(), 'monk')).toEqual(['Safe']);
		expect(labelsOf(s.newDay().dusk(), 'monk')).toEqual([]);
	});

	it('follows a custom character’s own reminderEnds', () => {
		const brew: Character = {
			...(data.byId.get('monk') as Character),
			id: 'warden',
			name: 'Warden',
			reminders: ['Guarded'],
			rules: parseCharacterRules({ reminderEnds: { Guarded: 'dusk' } }, 'warden', new Issues())
		};
		const script: Script = {
			entries: [{ kind: 'custom', character: brew }, ...['chef', 'imp'].map(official)]
		};
		const s = scenario(['warden', 'chef', 'imp'], { script }).reminder('chef', 'warden', 'Guarded');
		expect(labelsOf(s.newDay(), 'warden')).toEqual(['Guarded']);
		expect(labelsOf(s.dusk(), 'warden')).toEqual([]);
	});
});

function official(id: string) {
	return { kind: 'official' as const, id };
}
