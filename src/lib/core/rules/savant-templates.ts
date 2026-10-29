/**
 * The Savant's statement templates, by group (`savant.ts` works them out). Our own wording,
 * approved by Trevor; none is copied from another generator or the wiki.
 */
import { aliveNeighbours, trueCharacter, typeOf } from '#lib/core/model/selectors.ts';
import { rulesOf } from '#lib/core/data/rules/index.ts';
import { BASE_DISTRIBUTION } from './distribution.ts';
import type { DayEntry } from '#lib/core/model/types.ts';
import type { RegistrationWorld } from './ability.ts';
import { abnormalSinceDawn } from './night-info.ts';

import {
	text,
	distance,
	sideBySide,
	count,
	alive,
	typed,
	isEvil,
	demonSeat,
	demonsOnScript,
	pairs,
	longestRun,
	hasReminder,
	hasLabel,
	ownNoAbility,
	seatOf,
	nominations,
	choiceMarkers,
	inPlayWith,
	triples,
	type Template
} from './savant-facts.ts';
import { LOG_TEMPLATES } from './savant-log-templates.ts';

export const SAVANT_TEMPLATES: readonly Template[] = [
	// ── Characters ──
	{
		id: 'in-play',
		group: 'characters',
		instances: (f) =>
			f.script
				.filter((id) => f.characters.get(id)?.type !== 'demon')
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(' is in play.')],
					holds: () => f.inPlay.has(id)
				}))
	},
	{
		id: 'not-in-play',
		group: 'characters',
		// A Demon too, on a script with more than one.
		instances: (f) =>
			f.script
				.filter((id) => f.characters.get(id)?.type !== 'demon' || demonsOnScript(f) > 1)
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(' is not in play.')],
					holds: () => !f.inPlay.has(id)
				}))
	},
	{
		id: 'either-in-play',
		group: 'characters',
		// Two characters of the same type, so the line is a real choice.
		instances: (f) =>
			pairs(f.script.filter((id) => f.characters.get(id)?.type !== 'demon'))
				.filter(([a, b]) => f.characters.get(a)?.type === f.characters.get(b)?.type)
				.map(([a, b]) => ({
					blanks: `${a}|${b}`,
					parts: [{ character: a }, text(' or '), { character: b }, text(' is in play.')],
					holds: () => f.inPlay.has(a) || f.inPlay.has(b)
				}))
	},
	{
		id: 'bluff',
		group: 'characters',
		instances(f) {
			const bluffs = f.game.bluffs[0] ?? [];
			if (bluffs.length === 0) return [];
			return f.script
				.filter(
					(id) =>
						!f.inPlay.has(id) &&
						['townsfolk', 'outsider'].includes(f.characters.get(id)?.type ?? '')
				)
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(" is one of the Demon's bluffs.")],
					holds: () => bluffs.includes(id)
				}));
		}
	},
	// ── Counts ──
	count(
		'outsiders',
		'counts',
		(f, w) => typed(f, w, 'outsider').length,
		(n) => [
			text('There '),
			text(n === 1 ? 'is ' : 'are '),
			{ number: n },
			text(n === 1 ? ' Outsider in play.' : ' Outsiders in play.')
		],
		(f) => Math.min(f.n - 2, 4)
	),
	count(
		'minions-alive',
		'counts',
		(f, w) => typed(f, w, 'minion').filter((s) => !f.dead(s)).length,
		(n) => [{ number: n }, text(n === 1 ? ' Minion is alive.' : ' Minions are alive.')],
		(f) => Math.min(alive(f).length, 4)
	),
	count(
		'dead-evil',
		'counts',
		(f, w) => {
			const dead = f.seats.filter(f.dead);
			return dead.length === 0 ? undefined : dead.filter((s) => isEvil(w, s)).length;
		},
		(n) => [
			{ number: n },
			text(n === 1 ? ' of the dead players is evil.' : ' of the dead players are evil.')
		],
		(f) => f.seats.filter(f.dead).length
	),
	count(
		'impaired',
		'counts',
		(f) => f.seats.filter(f.impaired).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' player is drunk or poisoned right now.'
					: ' players are drunk or poisoned right now.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'townsfolk-alive',
		'counts',
		(f, w) => typed(f, w, 'townsfolk').filter((s) => !f.dead(s)).length,
		(n) => [{ number: n }, text(n === 1 ? ' Townsfolk is alive.' : ' Townsfolk are alive.')],
		(f) => alive(f).length,
		1
	),
	// ── Alignment and seating ──
	{
		id: 'same-alignment',
		group: 'alignment',
		instances: (f) =>
			pairs(f.others).flatMap(([a, b]) => [
				{
					blanks: `${a}|${b}|same`,
					parts: [{ seat: a }, text(' and '), { seat: b }, text(' have the same alignment.')],
					holds: (w) => w.alignment(a) !== undefined && w.alignment(a) === w.alignment(b)
				},
				{
					blanks: `${a}|${b}|different`,
					parts: [{ seat: a }, text(' and '), { seat: b }, text(' have different alignments.')],
					holds: (w) =>
						w.alignment(a) !== undefined &&
						w.alignment(b) !== undefined &&
						w.alignment(a) !== w.alignment(b)
				}
			])
	},
	count(
		'evil-neighbours',
		'alignment',
		(f, w) => aliveNeighbours(f.game, f.savant).filter((s) => isEvil(w, s)).length,
		(n) => [
			{ number: n },
			text(n === 1 ? ' of your living neighbours is evil.' : ' of your living neighbours are evil.')
		],
		(f) => aliveNeighbours(f.game, f.savant).length
	),
	count(
		'evil-pairs',
		'alignment',
		(f, w) => {
			const s = f.game.seating;
			return s.filter((x, i) => isEvil(w, x) && isEvil(w, s[(i + 1) % s.length])).length;
		},
		(n) => [text('A Chef would learn '), { number: n }, text('.')],
		(f) => Math.min(f.n, 4)
	),
	{
		id: 'alignment',
		group: 'alignment',
		instances: (f) =>
			f.others.flatMap((s) =>
				(['good', 'evil'] as const).map((a) => ({
					blanks: `${s}|${a}`,
					parts: [{ seat: s }, text(` is ${a}.`)],
					holds: (w: RegistrationWorld) => w.alignment(s) === a
				}))
			)
	},
	...(['good', 'evil'] as const).map((a) =>
		count(
			`${a}-run`,
			'alignment',
			(f, w) => longestRun(f, w, a),
			(n) => [
				text(`The longest unbroken run of ${a} players around the circle is `),
				{ number: n },
				text('.')
			],
			(f) => f.n,
			a === 'good' ? 1 : 0
		)
	),
	// ── Character types ──
	{
		id: 'one-of-two',
		group: 'types',
		// Like the Washerwoman, Librarian or Investigator: the character is one of the two.
		instances: (f) =>
			f.script
				.filter((id) =>
					['townsfolk', 'outsider', 'minion'].includes(f.characters.get(id)?.type ?? '')
				)
				.flatMap((id) =>
					pairs(f.others).map(([a, b]) => ({
						blanks: `${id}|${a}|${b}`,
						parts: [
							text('One of '),
							{ seat: a },
							text(' and '),
							{ seat: b },
							text(' is the '),
							{ character: id },
							text('.')
						],
						holds: () =>
							trueCharacter(f.game, a, f.characters) === id ||
							trueCharacter(f.game, b, f.characters) === id
					}))
				)
	},
	{
		id: 'is-type',
		group: 'types',
		instances: (f) =>
			f.others.flatMap((s) =>
				(['townsfolk', 'outsider', 'minion'] as const).map((t) => ({
					blanks: `${s}|${t}`,
					parts: [
						{ seat: s },
						text(` is ${t === 'outsider' ? 'an' : 'a'} `),
						{ type: t },
						text('.')
					],
					holds: (w: RegistrationWorld) => w.type(s) === t
				}))
			)
	},
	{
		id: 'type-beside',
		group: 'types',
		instances: (f) =>
			(['townsfolk', 'outsider', 'minion', 'demon'] as const).map((t) => ({
				blanks: t,
				parts: [
					text(`${t === 'outsider' ? 'An' : 'A'} `),
					{ type: t },
					text(' is sitting next to you.')
				],
				holds: (w: RegistrationWorld) => sideBySide(f, f.savant).some((s) => w.type(s) === t)
			}))
	},
	// ── The Demon ──
	{
		id: 'demon-is',
		group: 'demon',
		// Only on scripts with more than one Demon: with one, the answer is on the script.
		instances(f) {
			if (demonsOnScript(f) < 2) return [];
			return f.script
				.filter((id) => f.characters.get(id)?.type === 'demon')
				.map((id) => ({
					blanks: id,
					parts: [text('The Demon is the '), { character: id }, text('.')],
					holds: (w: RegistrationWorld) => {
						const d = demonSeat(f, w);
						return d !== undefined && trueCharacter(f.game, d, f.characters) === id;
					}
				}));
		}
	},
	{
		id: 'demon-beside',
		group: 'demon',
		instances: (f) =>
			(['minion', 'outsider'] as const).flatMap((t) => {
				const beside = (w: RegistrationWorld) => {
					const d = demonSeat(f, w);
					return d !== undefined && sideBySide(f, d).some((s) => w.type(s) === t);
				};
				const a = t === 'outsider' ? 'an' : 'a';
				return [
					{
						blanks: `${t}|yes`,
						parts: [text(`The Demon is sitting next to ${a} `), { type: t }, text('.')],
						holds: beside
					},
					{
						blanks: `${t}|no`,
						parts: [text('The Demon is not sitting next to any '), { type: t }, text('.')],
						holds: (w: RegistrationWorld) => demonSeat(f, w) !== undefined && !beside(w)
					}
				];
			})
	},
	count(
		'demon-townsfolk',
		'demon',
		(f, w) => {
			const d = demonSeat(f, w);
			return d === undefined
				? undefined
				: sideBySide(f, d).filter((s) => w.type(s) === 'townsfolk').length;
		},
		(n) => [
			text('The Demon is sitting next to '),
			{ number: n },
			text(' '),
			{ type: 'townsfolk' },
			text('.')
		],
		() => 2
	),
	count(
		'demon-minion-distance',
		'demon',
		// Like the Clockmaker: steps from the Demon to its nearest Minion.
		(f, w) => {
			const d = demonSeat(f, w);
			const minions = typed(f, w, 'minion');
			if (d === undefined || minions.length === 0) return undefined;
			return Math.min(...minions.map((m) => distance(f, d, m)));
		},
		(n) => [
			text('The Demon is '),
			{ number: n },
			text(n === 1 ? ' seat from its nearest Minion.' : ' seats from its nearest Minion.')
		],
		(f) => Math.floor(f.game.seating.length / 2),
		1
	),
	{
		id: 'demon-within',
		group: 'demon',
		instances(f, w0) {
			const max = Math.floor(f.game.seating.length / 2) - 1;
			if (demonSeat(f, w0) === undefined || max < 1) return [];
			return Array.from({ length: max }, (_, i) => i + 1).map((n) => ({
				blanks: String(n),
				parts: [
					text('The Demon is within '),
					{ number: n },
					text(n === 1 ? ' seat of you.' : ' seats of you.')
				],
				holds: (w: RegistrationWorld) => {
					const d = demonSeat(f, w);
					return d !== undefined && distance(f, d, f.savant) <= n;
				}
			}));
		}
	},
	// ── Today ──
	{
		id: 'evil-nominated',
		group: 'today',
		instances(f) {
			const nominators = f.game.today.entries
				.filter((e): e is Extract<DayEntry, { kind: 'nomination' }> => e.kind === 'nomination')
				.map((e) => e.nominator);
			if (nominators.length === 0) return [];
			const any = (w: RegistrationWorld) => nominators.some((s) => isEvil(w, s));
			return [
				{ blanks: 'yes', parts: [text('An evil player has nominated today.')], holds: any },
				{
					blanks: 'no',
					parts: [text('No evil player has nominated today.')],
					holds: (w: RegistrationWorld) => !any(w)
				}
			];
		}
	},
	{
		id: 'evil-dead',
		group: 'today',
		instances(f) {
			const dead = f.seats.filter(f.dead);
			if (dead.length === 0) return [];
			const any = (w: RegistrationWorld) => dead.some((s) => isEvil(w, s));
			return [
				{ blanks: 'yes', parts: [text('An evil player is dead.')], holds: any },
				{
					blanks: 'no',
					parts: [text('Every evil player is alive.')],
					holds: (w: RegistrationWorld) => !any(w)
				}
			];
		}
	},
	// ── From The Grimoire's generator, reworded (Trevor, 2026-10-22: "include all") ──
	{
		id: 'outsiders-changed',
		group: 'counts',
		// Against the setup sheet's count for this many dealt players.
		instances(f) {
			const dealt = f.seats.filter((s) => typeOf(f.game, s, f.characters) !== 'traveller');
			const base = BASE_DISTRIBUTION[dealt.length]?.outsider;
			if (base === undefined) return [];
			const changed = () =>
				dealt.filter((s) => typeOf(f.game, s, f.characters) === 'outsider').length !== base;
			return [
				{
					blanks: 'yes',
					parts: [text('The number of Outsiders was changed during setup.')],
					holds: changed
				},
				{
					blanks: 'no',
					parts: [text('The number of Outsiders was not changed during setup.')],
					holds: () => !changed()
				}
			];
		}
	},
	count(
		'abnormal-last-night',
		'today',
		// From the night info recorded as abnormal before the last "New day".
		(f) => (f.yesterday ? abnormalSinceDawn({ ...f.game, today: f.yesterday }).length : undefined),
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' ability did not work as it should last night.'
					: ' abilities did not work as they should last night.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'mad',
		'today',
		(f) => f.seats.filter((s) => hasLabel(f, s, 'Mad')).length,
		(n) => [
			text('At least '),
			{ number: n },
			text(n === 1 ? ' player is mad right now.' : ' players are mad right now.')
		],
		(f) => Math.min(f.n, 3)
	),
	{
		id: 'mad-alignment',
		group: 'today',
		instances: (f) => {
			const mad = f.seats.filter((s) => hasLabel(f, s, 'Mad'));
			return [
				{
					blanks: 'none',
					parts: [text('No one is mad right now.')],
					holds: () => mad.length === 0
				},
				...(['good', 'evil'] as const).map((a) => ({
					blanks: a,
					parts: [text(`${a === 'evil' ? 'An' : 'A'} ${a} player is mad right now.`)],
					holds: (w: RegistrationWorld) => mad.some((s) => w.alignment(s) === a)
				}))
			];
		}
	},
	{
		id: 'madness-in-play',
		group: 'characters',
		instances: (f) => [
			{
				blanks: '',
				parts: [text('No character in play can make anyone mad.')],
				holds: () =>
					![...f.inPlay].some((id) => /\bmad\b/i.test(f.characters.get(id)?.ability ?? ''))
			}
		]
	},
	count(
		'once-used',
		'today',
		// A player carrying their own character's "No Ability" reminder has used it.
		(f) => f.seats.filter((s) => ownNoAbility(f, s)).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' once-per-game ability has been used.'
					: ' once-per-game abilities have been used.'
			)
		],
		(f) => Math.min(f.n, 4)
	),
	count(
		'impaired-neighbours',
		'counts',
		(f) => aliveNeighbours(f.game, f.savant).filter(f.impaired).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' of your living neighbours is drunk or poisoned.'
					: ' of your living neighbours are drunk or poisoned.'
			)
		],
		(f) => aliveNeighbours(f.game, f.savant).length
	),
	{
		id: 'sit-together',
		group: 'characters',
		instances: (f) =>
			pairs(f.script.filter((id) => f.characters.get(id)?.type !== 'demon')).map(([a, b]) => ({
				blanks: `${a}|${b}`,
				parts: [
					{ character: a },
					text(' and '),
					{ character: b },
					text(' sit next to each other.')
				],
				holds: () => {
					const sa = seatOf(f, a);
					const sb = seatOf(f, b);
					return sa !== undefined && sb !== undefined && sideBySide(f, sa).includes(sb);
				}
			}))
	},
	{
		id: 'cursed',
		group: 'today',
		// The Witch's Cursed (`curses`) on the Savant.
		instances: (f) =>
			inPlayWith(f, (r) => r.curses).flatMap(([id, token]) => [
				{
					blanks: `${id}|yes`,
					parts: [text('You are cursed by the '), { character: id }, text('.')],
					holds: () => hasReminder(f, f.savant, id, token)
				},
				{
					blanks: `${id}|no`,
					parts: [text('You are not cursed by the '), { character: id }, text('.')],
					holds: () => !hasReminder(f, f.savant, id, token)
				}
			])
	},
	{
		id: 'neighbours-alignment',
		group: 'alignment',
		instances(f) {
			const [a, b] = aliveNeighbours(f.game, f.savant);
			if (a === undefined || b === undefined) return [];
			const same = (w: RegistrationWorld) =>
				w.alignment(a) !== undefined && w.alignment(a) === w.alignment(b);
			return [
				{
					blanks: 'same',
					parts: [text('Your living neighbours share an alignment.')],
					holds: same
				},
				{
					blanks: 'different',
					parts: [text('Your living neighbours have different alignments.')],
					holds: (w: RegistrationWorld) => w.alignment(b) !== undefined && !same(w)
				}
			];
		}
	},
	{
		id: 'nominated-yesterday',
		group: 'today',
		instances(f) {
			const nominators = nominations(f.yesterday).map((e) =>
				trueCharacter(f.game, e.nominator, f.characters)
			);
			if (nominators.length === 0) return [];
			return [...f.inPlay]
				.filter((id) => f.characters.get(id)?.type !== 'demon')
				.map((id) => ({
					blanks: id,
					parts: [{ character: id }, text(' nominated yesterday.')],
					holds: () => nominators.includes(id)
				}));
		}
	},
	{
		id: 'nominee-yesterday',
		group: 'today',
		instances(f) {
			const nominees = nominations(f.yesterday).map((e) => e.nominee);
			if (nominees.length === 0) return [];
			return [
				{
					blanks: 'evil',
					parts: [text('An evil player was nominated yesterday.')],
					holds: (w: RegistrationWorld) => nominees.some((s) => isEvil(w, s))
				},
				{
					blanks: 'outsider',
					parts: [text('An '), { type: 'outsider' }, text(' was nominated yesterday.')],
					holds: (w: RegistrationWorld) => nominees.some((s) => w.type(s) === 'outsider')
				}
			];
		}
	},
	{
		id: 'minion-chose',
		group: 'today',
		// Where a Minion's choice reminder sits says whom it chose.
		instances: (f) =>
			choiceMarkers(f, 'minion').flatMap(([minion, labels]) =>
				[...f.inPlay]
					.filter((id) => id !== minion && f.characters.get(id)?.type !== 'demon')
					.map((id) => ({
						blanks: `${minion}|${id}`,
						parts: [
							text('The '),
							{ character: minion },
							text(' chose the '),
							{ character: id },
							text(' last night.')
						],
						holds: () => {
							const s = seatOf(f, id);
							return s !== undefined && labels.some((l) => hasReminder(f, s, minion, l));
						}
					}))
			)
	},
	count(
		'neighbours-reminded',
		'today',
		(f) =>
			aliveNeighbours(f.game, f.savant).filter((s) =>
				f.game.seats[s].reminders.some(
					(r) =>
						r.characterId !== trueCharacter(f.game, s, f.characters) &&
						r.characterId !== f.game.seats[s].characterId
				)
			).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? " of your living neighbours carries another character's reminder."
					: " of your living neighbours carry another character's reminder."
			)
		],
		(f) => aliveNeighbours(f.game, f.savant).length
	),
	{
		id: 'one-of-three-evil',
		group: 'alignment',
		// Like the Noble: exactly one of three players is evil.
		instances: (f) =>
			triples(f.others).map(([a, b, c]) => ({
				blanks: `${a}|${b}|${c}`,
				parts: [
					text('Exactly one of '),
					{ seat: a },
					text(', '),
					{ seat: b },
					text(' and '),
					{ seat: c },
					text(' is evil.')
				],
				holds: (w: RegistrationWorld) => [a, b, c].filter((s) => isEvil(w, s)).length === 1
			}))
	},
	{
		id: 'character-impaired',
		group: 'characters',
		instances: (f) =>
			[...f.inPlay]
				.filter(
					(id) =>
						rulesOf(id, f.characters)?.dayClaim !== 'statements' &&
						f.characters.get(id)?.type !== 'demon'
				)
				.map((id) => ({
					blanks: id,
					parts: [text('The '), { character: id }, text(' is drunk or poisoned.')],
					holds: () => {
						const s = seatOf(f, id);
						return s !== undefined && f.impaired(s);
					}
				}))
	},
	{
		id: 'died-not-demon',
		group: 'today',
		// Only deaths whose cause names a character that is not a Demon, or a Demon.
		instances: (f) =>
			f.others.flatMap((s) => {
				const cause = f.game.seats[s].deathCause;
				if (!f.game.seats[s].dead || !cause || ['execution', 'exile', 'other'].includes(cause))
					return [];
				const byDemon = cause === 'demon' || f.characters.get(cause)?.type === 'demon';
				const atNight = byDemon || (f.characters.get(cause)?.otherNight ?? 0) > 0;
				if (!atNight) return [];
				return [
					{
						blanks: s,
						parts: [{ seat: s }, text(' died at night, but not to the Demon.')],
						holds: () => !byDemon
					}
				];
			})
	},
	count(
		'townsfolk-pairs',
		'counts',
		(f, w) => {
			const s = f.game.seating;
			return s.filter(
				(x, i) => w.type(x) === 'townsfolk' && w.type(s[(i + 1) % s.length]) === 'townsfolk'
			).length;
		},
		(n) => [
			text('There '),
			text(n === 1 ? 'is ' : 'are '),
			{ number: n },
			text(n === 1 ? ' pair of ' : ' pairs of '),
			{ type: 'townsfolk' },
			text(' sitting next to each other.')
		],
		(f) => f.n
	),
	count(
		'unaware',
		'counts',
		// The Drunk, Marionette and others shown another token, and the Lunatic
		// (`believesOtherCharacter`).
		(f) =>
			f.seats.filter((s) => {
				const id = trueCharacter(f.game, s, f.characters);
				const believes = id !== undefined && rulesOf(id, f.characters)?.believesOtherCharacter;
				return believes || id !== f.game.seats[s].characterId;
			}).length,
		(n) => [
			{ number: n },
			text(
				n === 1
					? ' player does not know their true character.'
					: ' players do not know their true character.'
			)
		],
		(f) => Math.min(f.n, 3)
	),
	...LOG_TEMPLATES
];
