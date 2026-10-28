/**
 * The Savant's statement templates that read the day log (`savant-templates.ts` adds them
 * last). Our own wording, approved by Trevor; see `savant.ts`.
 */
import type { CharacterType } from '#lib/core/data/types.ts';
import { alignmentOf, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import type { Game } from '#lib/core/model/types.ts';
import type { RegistrationWorld } from './ability.ts';

import {
	text,
	count,
	alive,
	typed,
	isEvil,
	hasReminder,
	choiceMarkers,
	manual,
	infoIs,
	demonHidden,
	inPlayWith,
	infoEntries,
	wakes,
	castOf,
	demonCanPass,
	type Template
} from './savant-facts.ts';

export const LOG_TEMPLATES: readonly Template[] = [
	count(
		'townsfolk-chose-evil',
		'today',
		// Only choices that leave a reminder (`marksChoice`): the Monk's Safe, the Exorcist's Chosen.
		(f, w) => {
			const choosers = choiceMarkers(f, 'townsfolk');
			if (choosers.length === 0) return undefined;
			return choosers.filter(([id, labels]) =>
				f.seats.some((s) => isEvil(w, s) && labels.some((l) => hasReminder(f, s, id, l)))
			).length;
		},
		(n) => [
			{ number: n },
			text(' '),
			{ type: 'townsfolk' },
			text(n === 1 ? ' chose an evil player last night.' : ' chose evil players last night.')
		],
		(f) => choiceMarkers(f, 'townsfolk').length
	),
	{
		id: 'townsfolk-true-info',
		group: 'today',
		instances(f) {
			const told = infoEntries(f.yesterday).filter(
				(e) => f.characters.get(e.characterId)?.type === 'townsfolk'
			);
			if (told.length === 0) return [];
			return [
				{
					blanks: '',
					parts: [text('Every '), { type: 'townsfolk' }, text(' got true information last night.')],
					holds: () => told.every((e) => (e.abnormal ?? []).length === 0)
				}
			];
		}
	},
	{
		id: 'good-woke',
		group: 'today',
		instances: (f) =>
			f.lastDawn
				? [
						{
							blanks: '',
							parts: [text('A good player woke last night.')],
							holds: (w: RegistrationWorld) =>
								alive(f).some(
									(s) =>
										s !== f.savant &&
										w.alignment(s) === 'good' &&
										wakes(f, trueCharacter(f.game, s, f.characters))
								)
						}
					]
				: []
	},
	count(
		'evil-woke',
		'today',
		(f, w) =>
			f.lastDawn
				? alive(f).filter((s) => isEvil(w, s) && wakes(f, trueCharacter(f.game, s, f.characters)))
						.length
				: undefined,
		(n) => [
			{ number: n },
			text(n === 1 ? ' evil player woke last night.' : ' evil players woke last night.')
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'given-number',
		'today',
		(f) => {
			const told = infoEntries(f.yesterday).filter((e) => infoIs(f, e.characterId, 'number'));
			return told.length === 0 ? undefined : new Set(told.map((e) => e.seatId)).size;
		},
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' player was given a number last night.'
					: ' players were given a number last night.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	{
		id: 'minion-same-player',
		group: 'today',
		// Where the Minion's choice reminder sat at each dawn, over at least two nights.
		instances(f) {
			if (f.dawns.length < 2) return [];
			return choiceMarkers(f, 'minion').map(([minion, labels]) => ({
				blanks: minion,
				parts: [
					text('The '),
					{ character: minion },
					text(' has chosen the same player every night.')
				],
				holds: () => {
					const chosen = f.dawns.map((g) =>
						g.seating.find((s) =>
							g.seats[s].reminders.some((r) => r.characterId === minion && labels.includes(r.label))
						)
					);
					return chosen[0] !== undefined && chosen.every((s) => s === chosen[0]);
				}
			}));
		}
	},
	{
		id: 'more-than-start',
		group: 'counts',
		instances(f) {
			const start = f.dawns[0];
			if (!start || f.dawns.length < 2) return [];
			const countIn = (g: Game, t: CharacterType) =>
				g.seating.filter((s) => typeOf(g, s, f.characters) === t).length;
			return (['outsider', 'townsfolk'] as const).flatMap((t) =>
				(['more', 'fewer'] as const).map((m) => ({
					blanks: `${t}|${m}`,
					parts: [text(`There are ${m} `), { type: t }, text(' than at the start.')],
					holds: () =>
						m === 'more'
							? countIn(f.game, t) > countIn(start, t)
							: countIn(f.game, t) < countIn(start, t)
				}))
			);
		}
	},
	{
		id: 'once-false',
		group: 'today',
		instances(f) {
			const told = f.game.pastDays
				.concat(f.game.today)
				.flatMap((log) => infoEntries(log))
				.filter((e) => infoIs(f, e.characterId, 'oncePerGame'));
			if (told.length === 0) return [];
			return [
				{
					blanks: '',
					parts: [text('A once-per-game ability gave false information.')],
					holds: () => told.some((e) => (e.abnormal ?? []).length > 0)
				}
			];
		}
	},
	{
		id: 'demon-cannot-pass',
		group: 'demon',
		instances: (f, w0) =>
			demonCanPass(f, w0) === undefined
				? []
				: [
						{
							blanks: '',
							parts: [text('The Demon cannot pass to another player.')],
							holds: (w: RegistrationWorld) => demonCanPass(f, w) === false
						}
					]
	},
	{
		id: 'changed-since',
		group: 'today',
		// Between yesterday's New day and this morning's.
		instances(f) {
			const [before, after] = [f.dawns.at(-2), f.dawns.at(-1)];
			if (!before || !after) return [];
			const a = castOf(f, before);
			const b = castOf(f, after);
			const newCharacter = [...b.values()].some(
				(id) => id !== undefined && ![...a.values()].includes(id)
			);
			const changed = after.seating.some((s) => a.get(s) !== undefined && a.get(s) !== b.get(s));
			const turned = after.seating.some(
				(s) => before.seats[s] && alignmentOf(before, s) !== alignmentOf(after, s)
			);
			return [
				{
					blanks: 'new',
					parts: [text('No new character came into play last night.')],
					holds: () => !newCharacter
				},
				{
					blanks: 'character',
					parts: [text("A player's character changed last night.")],
					holds: () => changed
				},
				{
					blanks: 'alignment',
					parts: [text("A player's alignment changed last night.")],
					holds: () => turned
				}
			];
		}
	},
	{
		id: 'minion-unaware',
		group: 'demon',
		instances: (f) =>
			typed(
				f,
				{
					alignment: (s) => alignmentOf(f.game, s),
					type: (s) => typeOf(f.game, s, f.characters),
					misregistered: []
				},
				'minion'
			).length === 0
				? []
				: [
						{
							blanks: '',
							parts: [
								text('At least one '),
								{ type: 'minion' },
								text(' did not learn who the Demon was at the start.')
							],
							holds: () => f.n < 7 || demonHidden(f)
						}
					]
	},
	{
		id: 'started-good',
		group: 'alignment',
		instances(f) {
			const start = f.dawns[0];
			if (!start) return [];
			return f.others
				.filter((s) => start.seats[s] && trueCharacter(f.game, s, f.characters) !== undefined)
				.map((s) => {
					const id = trueCharacter(f.game, s, f.characters)!;
					return {
						blanks: id,
						parts: [{ character: id }, text(' started the game good and is now evil.')],
						holds: () => alignmentOf(start, s) === 'good' && alignmentOf(f.game, s) === 'evil'
					};
				})
				.filter((x) => f.characters.get(x.blanks)?.type !== 'demon');
		}
	},
	{
		id: 'chose-like-demon',
		group: 'today',
		// The Lunatic's Chosen reminders (`choosesLikeDemon`) against whom the Demon killed last night.
		instances(f) {
			const mimics = inPlayWith(f, (r) => r.choosesLikeDemon);
			if (mimics.length === 0 || !f.dawns.at(-1)) return [];
			const before = f.dawns.at(-2);
			const victims = f.seats.filter((s) => {
				const seat = f.dawns.at(-1)!.seats[s];
				const cause = seat?.deathCause;
				const byDemon =
					cause === 'demon' || (cause !== undefined && f.characters.get(cause)?.type === 'demon');
				return seat?.dead && byDemon && !(before?.seats[s]?.dead ?? false);
			});
			if (victims.length === 0) return [];
			return mimics.map(([id, token]) => {
				const chosen = f.seats.filter((s) => hasReminder(f, s, id, token));
				return {
					blanks: id,
					parts: [
						text('The '),
						{ character: id },
						text(' and the Demon chose different players last night.')
					],
					holds: () => !victims.some((v) => chosen.includes(v))
				};
			});
		}
	},
	{
		id: 'character-true-info',
		group: 'today',
		instances: (f) =>
			[...new Set(infoEntries(f.yesterday).map((e) => e.characterId))]
				.filter((id) => id !== 'savant')
				.map((id) => ({
					blanks: id,
					parts: [
						text('The '),
						{ character: id },
						text(' got sober, healthy and true information last night.')
					],
					holds: () =>
						infoEntries(f.yesterday)
							.filter((e) => e.characterId === id)
							.every((e) => (e.abnormal ?? []).length === 0)
				}))
	},
	{
		id: 'poisoned-true',
		group: 'today',
		// Only when a poisoned Townsfolk's info was recorded; whether it was true is the Storyteller's call.
		instances: (f) =>
			infoEntries(f.yesterday).some(
				(e) =>
					f.characters.get(e.characterId)?.type === 'townsfolk' &&
					(e.abnormal ?? []).some((c) => c.reason === 'poisoned')
			)
				? [
						{
							blanks: '',
							parts: [
								text('A poisoned '),
								{ type: 'townsfolk' },
								text(' got true information last night.')
							],
							holds: () => false,
							manual: true
						}
					]
				: []
	},
	// A choice no reminder records (`choosesUnmarked`: the Snake Charmer's, unless it hits the Demon).
	manual('unmarked-chose', (f) => {
		const [id] = inPlayWith(f, (r) => r.choosesUnmarked)[0] ?? [];
		return id === undefined
			? undefined
			: [
					text('The '),
					{ character: id },
					text(' chose a '),
					{ type: 'minion' },
					text(' last night.')
				];
	}),
	manual('declined', () => [text('Someone chose not to use their ability last night.')])
];
