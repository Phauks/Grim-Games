/**
 * Setup reminders. Each curated entry cites its character's wiki page in
 * `setup-reminders.data.ts`; the behaviour tests below cite the pages they encode.
 */
import { describe, expect, it } from 'vitest';
import { newGame, run, testCharacters } from '#lib/core/model/fixtures.test-support.ts';
import type { Command } from '#lib/core/engine/commands.ts';
import { dispatch, redo, undo, type GameSession } from '#lib/core/engine/log.ts';
import type { EngineContext } from '#lib/core/engine/context.ts';
import { committedGameData } from '#lib/core/testing/committed-data.ts';
import { characterNames } from './character-names.ts';
import {
	NO_SETUP_REMINDERS,
	SETUP_NOTES,
	SETUP_REMINDER_ENTRIES,
	placeableSetupReminders,
	prepTextSegments,
	prepTokens,
	setupPrep,
	setupReminders,
	type SetupReminderOptions
} from './setup-reminders.ts';

const data = committedGameData();

/**
 * A game whose seats hold these characters, in order. A `drunk:empath` entry is the Drunk
 * shown the Empath; `+x` gives the seat that alignment.
 */
function grimoire(
	characters: string[],
	extra: Command[] = []
): { session: GameSession; ctx: EngineContext; seats: string[] } {
	const { session, ctx, seats } = newGame(characters.length);
	const commands: Command[] = characters.flatMap((spec, i): Command[] => {
		const [name, alignment] = spec.split('+');
		const [truly, shown] = name.split(':');
		const seatId = seats[i];
		const assign: Command = {
			type: 'AssignCharacter',
			seatId,
			characterId: shown ?? truly,
			...(alignment ? { alignment: alignment as 'good' | 'evil' } : {})
		};
		if (!shown) return [assign];
		const label = `Is The ${data.byId.get(truly)!.name}`;
		return [assign, { type: 'AddReminder', seatId, reminder: { characterId: truly, label } }];
	});
	return { session: run(session, ctx, ...commands, ...extra), ctx, seats };
}

function suggest(characters: string[], options?: SetupReminderOptions, extra: Command[] = []) {
	const { session, seats } = grimoire(characters, extra);
	return { list: setupReminders(session.game, testCharacters, options), seats, session };
}

/** "label → seat index" for a pre-filled suggestion, "label ?" when the Storyteller picks. */
function brief(characters: string[], options?: SetupReminderOptions, extra: Command[] = []) {
	const { list, seats } = suggest(characters, options, extra);
	return list.map(
		(s) =>
			`${s.characterId}: ${s.label} ${s.seatId === undefined ? '?' : `→ ${seats.indexOf(s.seatId)}`}`
	);
}

describe('coverage', () => {
	it('considers every official character exactly once', () => {
		const curated = SETUP_REMINDER_ENTRIES.map((e) => e.id);
		const quiet = Object.keys(NO_SETUP_REMINDERS);
		expect(new Set(curated).size).toBe(curated.length);
		expect(curated.filter((id) => quiet.includes(id))).toEqual([]);
		const all = new Set([...curated, ...quiet]);
		expect(data.characters.filter((c) => !all.has(c.id)).map((c) => c.id)).toEqual([]);
		expect([...all].filter((id) => !data.byId.has(id))).toEqual([]);
	});

	it('uses only reminder tokens the character really has, no more than it has', () => {
		for (const entry of SETUP_REMINDER_ENTRIES) {
			const c = data.byId.get(entry.id)!;
			const tokens = [...c.reminders, ...c.remindersGlobal];
			for (const spec of entry.reminders) {
				const used = entry.reminders.filter((s) => s.label === spec.label).length;
				const owned = tokens.filter((t) => t === spec.label).length;
				expect(owned, `${entry.id}: ${spec.label}`).toBeGreaterThanOrEqual(used);
			}
		}
	});

	it('cites a wiki page, a reason and, for a choice, what to choose', () => {
		for (const entry of SETUP_REMINDER_ENTRIES) {
			expect(entry.wiki, entry.id).toMatch(/^https:\/\/wiki\.bloodontheclocktower\.com\/\S+$/);
			for (const spec of entry.reminders) {
				expect(spec.reason.length, entry.id).toBeGreaterThan(0);
				if ('choose' in spec.target) expect(spec.target.choice.length, entry.id).toBeGreaterThan(0);
			}
		}
	});

	it('names its token in [brackets] in each step’s text', () => {
		for (const entry of SETUP_REMINDER_ENTRIES) {
			for (const spec of entry.reminders) {
				expect(spec.text, entry.id).toContain(`[${spec.label}]`);
			}
		}
	});

	it('keeps other preparation notes to real characters and their real tokens', () => {
		for (const [id, notes] of Object.entries(SETUP_NOTES)) {
			const c = data.byId.get(id);
			expect(c, id).toBeDefined();
			for (const note of notes) {
				for (const token of note.tokens ?? []) {
					expect([...c!.reminders, ...c!.remindersGlobal], id).toContain(token);
					expect(note.text, id).toContain(`[${token}]`);
				}
			}
		}
	});

	it('puts a token on the character’s own seat only for seated characters', () => {
		for (const entry of SETUP_REMINDER_ENTRIES) {
			const type = data.byId.get(entry.id)!.type;
			if (type === 'fabled' || type === 'loric') {
				expect(
					entry.reminders.every((s) => 'choose' in s.target),
					entry.id
				).toBe(true);
			}
		}
	});
});

describe('tokens on the character’s own seat', () => {
	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk thinks they are a Townsfolk,
	// and the Storyteller marks the real Drunk with IS THE DRUNK.
	it('marks the Drunk, unless the token is already there', () => {
		expect(brief(['drunk', 'chef', 'imp'])).toEqual(['drunk: Is The Drunk → 0']);
		expect(brief(['drunk:empath', 'chef', 'imp'])).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Marionette: the Marionette thinks they are good.
	it('marks the Marionette', () => {
		expect(brief(['chef', 'marionette', 'imp'])).toEqual(['marionette: Is The Marionette → 1']);
		expect(brief(['chef', 'marionette:empath', 'imp'])).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Xaan: night X is the number of Outsiders, and the
	// nights are counted from NIGHT 1.
	it('starts the Xaan’s night count, and marks night X when there is 1 Outsider', () => {
		expect(brief(['xaan', 'chef', 'imp'])).toEqual(['xaan: Night 1 → 0']);
		expect(brief(['xaan', 'saint', 'imp'])).toEqual(['xaan: Night 1 → 0', 'xaan: X → 0']);
		expect(brief(['xaan', 'saint', 'recluse', 'imp'])).toEqual(['xaan: Night 1 → 0']);
	});

	// https://wiki.bloodontheclocktower.com/Riot and
	// https://wiki.bloodontheclocktower.com/Leviathan: the day count starts on the first day.
	it('puts DAY 1 on the Riot and the Leviathan for the first day', () => {
		expect(brief(['riot', 'chef'])).toEqual(['riot: Day 1 → 0']);
		expect(brief(['chef', 'leviathan'])).toEqual(['leviathan: Day 1 → 1']);
		expect(brief(['riot', 'chef'], { timings: ['setup'] })).toEqual([]);
		expect(brief(['riot', 'drunk'], { timings: ['first-day'] })).toEqual(['riot: Day 1 → 0']);
	});
});

describe('tokens on a player the Storyteller picks', () => {
	// https://wiki.bloodontheclocktower.com/Washerwoman: TOWNSFOLK by a Townsfolk, WRONG by
	// any other player.
	it('pre-fills the Washerwoman’s Townsfolk when only one player fits', () => {
		const { list, seats } = suggest(['washerwoman', 'chef', 'saint', 'imp']);
		expect(list.map((s) => [s.label, s.seatId, s.choice])).toEqual([
			['Townsfolk', seats[1], undefined],
			['Wrong', undefined, 'any other player']
		]);
		// Wrong is neither the Washerwoman nor the Townsfolk player.
		expect(list[1].candidates).toEqual([seats[2], seats[3]]);
	});

	it('leaves the Washerwoman’s Townsfolk to the Storyteller when several fit', () => {
		const { list, seats } = suggest(['washerwoman', 'chef', 'empath', 'imp']);
		expect(list[0]).toMatchObject({
			label: 'Townsfolk',
			choice: 'a Townsfolk player',
			candidates: [seats[1], seats[2]]
		});
		expect(list[0].seatId).toBeUndefined();
	});

	// https://wiki.bloodontheclocktower.com/Washerwoman and
	// https://wiki.bloodontheclocktower.com/Drunk: the Drunk is not a Townsfolk, and a Drunk
	// who thinks they are the Washerwoman still gets information.
	it('reads true characters: a Drunk is not a Townsfolk and still gets Washerwoman tokens', () => {
		expect(brief(['drunk:washerwoman', 'drunk:chef', 'empath', 'imp'])).toEqual([
			'washerwoman: Townsfolk → 2',
			'washerwoman: Wrong ?'
		]);
	});

	// https://wiki.bloodontheclocktower.com/No_Dashii: while preparing the first night, the
	// nearest Townsfolk each way (skipping other types) are poisoned.
	it('poisons the No Dashii’s nearest Townsfolk each way', () => {
		expect(brief(['nodashii', 'saint', 'chef', 'empath', 'baron', 'monk'])).toEqual([
			'nodashii: Poisoned → 5',
			'nodashii: Poisoned → 2'
		]);
		// One Townsfolk nearest both ways gets one token; the other is left to the Storyteller.
		expect(brief(['nodashii', 'chef', 'saint'])).toEqual([
			'nodashii: Poisoned → 1',
			'nodashii: Poisoned ?'
		]);
	});

	// A placed Poisoned covers the suggestion for its own side, in either order.
	it('a placed No Dashii Poisoned leaves the other side’s suggestion', () => {
		const cast = ['nodashii', 'saint', 'chef', 'empath', 'baron', 'monk'];
		const poison =
			(i: number) =>
			(s: string[]): Command => ({
				type: 'AddReminder',
				seatId: s[i],
				reminder: { characterId: 'nodashii', label: 'Poisoned' }
			});
		const after = (i: number) => {
			const { seats } = grimoire(cast);
			return brief(cast, undefined, [poison(i)(seats)]);
		};
		// Clockwise (the Chef, seat 2) first: the anticlockwise Monk is left.
		expect(after(2)).toEqual(['nodashii: Poisoned → 5']);
		// Anticlockwise (the Monk, seat 5) first: the clockwise Chef is left.
		expect(after(5)).toEqual(['nodashii: Poisoned → 2']);
	});

	// https://wiki.bloodontheclocktower.com/Librarian: with no Outsiders in play the
	// Librarian learns 0, so there are no tokens; the Drunk is an Outsider.
	it('gives the Librarian tokens only when an Outsider is in play', () => {
		expect(brief(['librarian', 'chef', 'imp'])).toEqual([]);
		expect(brief(['librarian', 'drunk:chef', 'empath', 'imp'])).toEqual([
			'librarian: Outsider → 1',
			'librarian: Wrong ?'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Investigator
	it('pre-fills the Investigator’s Minion when there is one Minion', () => {
		expect(brief(['investigator', 'poisoner', 'chef', 'imp'])).toEqual([
			'investigator: Minion → 1',
			'investigator: Wrong ?'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Fortune_Teller: any good player, even the
	// Fortune Teller.
	it('offers every good player, the Fortune Teller too, as the red herring', () => {
		const { list, seats } = suggest(['fortuneteller', 'chef', 'poisoner', 'imp']);
		expect(list).toEqual([
			expect.objectContaining({
				characterId: 'fortuneteller',
				label: 'Red Herring',
				choice: 'any good player, even the Fortune Teller',
				candidates: [seats[0], seats[1]],
				timing: 'setup'
			})
		]);
	});

	it('does not suggest a token already in the grimoire', () => {
		const { seats } = grimoire(['fortuneteller', 'chef', 'imp']);
		const placed: Command = {
			type: 'AddReminder',
			seatId: seats[1],
			reminder: { characterId: 'fortuneteller', label: 'Red Herring' }
		};
		expect(brief(['fortuneteller', 'chef', 'imp'], undefined, [placed])).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Grandmother: the grandchild is a good player.
	it('pre-fills the Grandchild when one other good player is in play', () => {
		expect(brief(['grandmother', 'chef', 'poisoner', 'imp'])).toEqual([
			'grandmother: Grandchild → 1'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Evil_Twin: the good twin is a good player.
	it('offers the good players as the Evil Twin’s twin', () => {
		const { list, seats } = suggest(['eviltwin', 'chef', 'empath', 'imp']);
		expect(list).toEqual([
			expect.objectContaining({ label: 'Twin', candidates: [seats[1], seats[2]] })
		]);
		expect(brief(['eviltwin', 'chef', 'imp'])).toEqual(['eviltwin: Twin → 1']);
	});

	// https://wiki.bloodontheclocktower.com/Village_Idiot: with extra Village Idiots, one is
	// drunk.
	it('marks one of several Village Idiots as drunk', () => {
		expect(brief(['villageidiot', 'chef', 'imp'])).toEqual([]);
		const { list, seats } = suggest(['villageidiot', 'chef', 'villageidiot', 'imp']);
		expect(list).toEqual([
			expect.objectContaining({ label: 'Drunk', candidates: [seats[0], seats[2]] })
		]);
	});

	// https://wiki.bloodontheclocktower.com/Bounty_Hunter: KNOW on an evil player.
	it('points the Bounty Hunter at an evil player', () => {
		expect(brief(['bountyhunter', 'chef', 'imp'])).toEqual(['bountyhunter: Know → 2']);
		expect(brief(['bountyhunter', 'poisoner', 'imp'])).toEqual(['bountyhunter: Know ?']);
	});

	// https://wiki.bloodontheclocktower.com/Steward,
	// https://wiki.bloodontheclocktower.com/Knight and
	// https://wiki.bloodontheclocktower.com/Noble
	it('gives the Steward, Knight and Noble their KNOW tokens', () => {
		expect(brief(['steward', 'chef', 'imp'])).toEqual(['steward: Know → 1']);
		// Two different players who aren't the Demon.
		expect(brief(['knight', 'chef', 'poisoner', 'imp'])).toEqual([
			'knight: Know ?',
			'knight: Know ?'
		]);
		const { list, seats } = suggest(['knight', 'chef', 'imp']);
		expect(list.map((s) => s.seatId)).toEqual([seats[1], undefined]);
		expect(list[1].candidates).toEqual([]);
		// 1 evil and 2 good.
		expect(brief(['noble', 'chef', 'empath', 'imp'])).toEqual([
			'noble: Know → 3',
			'noble: Know ?',
			'noble: Know ?'
		]);
	});

	// https://wiki.bloodontheclocktower.com/Gnome: AMIGO on a player of the Gnome's alignment.
	it('offers the Gnome’s Amigo among players of the Gnome’s alignment', () => {
		expect(brief(['gnome+evil', 'chef', 'imp'])).toEqual(['gnome: Amigo → 2']);
	});

	// https://wiki.bloodontheclocktower.com/Revolutionary: a Fabled, so not on a seat; the
	// Storyteller marks the two Revolutionaries.
	it('covers Fabled and Loric in play', () => {
		const { list } = suggest(['chef', 'imp'], undefined, [
			{ type: 'AddRuleCharacter', characterId: 'revolutionary' }
		]);
		expect(list).toEqual([
			expect.objectContaining({ characterId: 'revolutionary', label: 'Register Falsely?' })
		]);
	});

	// https://wiki.bloodontheclocktower.com/Lunatic and
	// https://wiki.bloodontheclocktower.com/Sailor: no tokens before the first night.
	it('suggests nothing for characters that need no setup tokens', () => {
		expect(brief(['lunatic', 'sailor', 'huntsman', 'damsel', 'imp'])).toEqual([]);
		expect(NO_SETUP_REMINDERS.lunatic).toBeDefined();
	});
});

describe('setupPrep', () => {
	// https://wiki.bloodontheclocktower.com/Drunk and https://wiki.bloodontheclocktower.com/Knight
	it('lists each character’s preparation, one step per text', () => {
		expect(setupPrep('drunk', 'Drunk')).toEqual([
			{
				text: 'Put [Is The Drunk] on the Drunk; choose a not-in-play Townsfolk they think they are',
				tokens: ['Is The Drunk'],
				target: 'the Drunk'
			}
		]);
		expect(setupPrep('knight', 'Knight')).toEqual([
			{
				text: 'Choose 2 players who aren’t the Demon: put [Know] on each',
				tokens: ['Know', 'Know'],
				target: 'a player who isn’t the Demon'
			}
		]);
		// https://wiki.bloodontheclocktower.com/Noble: 1 evil and 2 good, so no single target.
		expect(setupPrep('noble', 'Noble')).toEqual([
			{
				text: 'Choose 3 players for the Noble, exactly 1 evil: put [Know] on each',
				tokens: ['Know', 'Know', 'Know']
			}
		]);
		// https://wiki.bloodontheclocktower.com/Mezepheles: a secret word, no token.
		expect(setupPrep('mezepheles', 'Mezepheles')).toEqual([
			{ text: 'Choose the Mezepheles’ secret word', tokens: [] }
		]);
		expect(setupPrep('chef', 'Chef')).toEqual([]);
	});

	// https://wiki.bloodontheclocktower.com/Grandmother, /Village_Idiot (Trevor’s review)
	it('uses the reviewed wording for the Grandmother and Village Idiot', () => {
		expect(setupPrep('grandmother', 'Grandmother')[0].text).toBe(
			'Choose a good player: put [Grandchild] on them'
		);
		expect(setupPrep('villageidiot', 'Village Idiot')[0].text).toBe(
			'If multiple Village Idiots, mark one as [Drunk] on them'
		);
	});

	// https://wiki.bloodontheclocktower.com/Yaggababble: the Storyteller picks the phrase.
	it('asks for a value where the Storyteller chooses one', () => {
		expect(setupPrep('yaggababble', 'Yaggababble')).toEqual([
			{
				text: 'Choose the Yaggababble’s secret phrase',
				tokens: [],
				value: { key: 'phrase', label: 'Secret phrase' }
			}
		]);
	});
});

describe('prepTokens', () => {
	// https://wiki.bloodontheclocktower.com/Fortune_Teller and /Village_Idiot
	it('lists the tokens placed before the first night, not on the first day', () => {
		expect(prepTokens('fortuneteller')).toEqual(['Red Herring']);
		expect(prepTokens('villageidiot')).toEqual(['Drunk']);
		expect(prepTokens('chef')).toEqual([]);
		for (const entry of SETUP_REMINDER_ENTRIES) {
			const firstDay = entry.reminders.filter((r) => r.timing === 'first-day').map((r) => r.label);
			const setup = entry.reminders.filter((r) => r.timing !== 'first-day').map((r) => r.label);
			for (const label of firstDay) {
				if (!setup.includes(label)) expect(prepTokens(entry.id), entry.id).not.toContain(label);
			}
		}
	});
});

describe('prepTextSegments', () => {
	it('draws [Token] as a reminder and character names as badges', () => {
		const names = characterNames(data.characters);
		expect(
			prepTextSegments('If multiple Village Idiots, put [Drunk] on the Fortune Teller', names)
		).toEqual([
			{ kind: 'text', text: 'If multiple Village Idiots, put ' },
			{ kind: 'reminder', label: 'Drunk' },
			{ kind: 'text', text: ' on the ' },
			{ kind: 'character', id: 'fortuneteller' }
		]);
	});
});

describe('ApplySetupReminders', () => {
	it('places the pre-filled suggestions as normal reminders, undone in one step', () => {
		const { session, ctx, seats } = grimoire(['drunk', 'washerwoman', 'chef', 'saint', 'imp']);
		const placements = placeableSetupReminders(setupReminders(session.game, testCharacters));
		expect(placements).toEqual([
			{ seatId: seats[0], reminder: { characterId: 'drunk', label: 'Is The Drunk' } },
			{ seatId: seats[2], reminder: { characterId: 'washerwoman', label: 'Townsfolk' } }
		]);
		const applied = dispatch(session, { type: 'ApplySetupReminders', placements }, ctx);
		if (!applied.ok) throw new Error(applied.error.message);
		expect(applied.warnings).toEqual([]);
		const { game } = applied.session;
		expect(game.seats[seats[0]].reminders).toMatchObject([{ label: 'Is The Drunk' }]);
		expect(game.seats[seats[2]].reminders).toMatchObject([{ label: 'Townsfolk' }]);
		// Placed, so no longer suggested.
		expect(placeableSetupReminders(setupReminders(game, testCharacters))).toEqual([]);

		const back = undo(applied.session);
		expect(back.game).toEqual(session.game);
		expect(redo(back).game).toEqual(game);

		// The Storyteller can move or remove each one.
		const townsfolk = game.seats[seats[2]].reminders[0].reminderId;
		const moved = run(applied.session, ctx, {
			type: 'MoveReminder',
			reminderId: townsfolk,
			toSeatId: seats[1]
		});
		expect(moved.game.seats[seats[1]].reminders.map((r) => r.label)).toEqual(['Townsfolk']);
		const removed = run(moved, ctx, { type: 'RemoveReminder', reminderId: townsfolk });
		expect(removed.game.seats[seats[1]].reminders).toEqual([]);
	});

	it('refuses an unknown seat and warns when there is nothing to place', () => {
		const { session, ctx } = grimoire(['chef', 'imp']);
		const bad = dispatch(
			session,
			{
				type: 'ApplySetupReminders',
				placements: [{ seatId: 'nobody', reminder: { characterId: 'chef', label: 'x' } }]
			},
			ctx
		);
		expect(bad.ok ? 'accepted' : bad.error.code).toBe('unknown-seat');
		const empty = dispatch(session, { type: 'ApplySetupReminders', placements: [] }, ctx);
		expect(empty.ok && empty.warnings.map((w) => w.code)).toEqual(['no-change']);
	});

	it('warns, like AddReminder, about a token the character does not have', () => {
		const { session, ctx, seats } = grimoire(['chef', 'imp']);
		const result = dispatch(
			session,
			{
				type: 'ApplySetupReminders',
				placements: [{ seatId: seats[0], reminder: { characterId: 'imp', label: 'Red Herring' } }]
			},
			ctx
		);
		expect(result.ok && result.warnings.map((w) => w.code)).toEqual(['reminder-not-for-character']);
	});
});
