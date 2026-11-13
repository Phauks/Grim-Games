/**
 * Every setup section a game mode or special rule file can set, as one field spec each
 * (`data/field-spec.ts`, refactor review A3): the reader checks a file against it
 * (`validate.ts`), the format guide and the Mode builder are drawn from it (`guideSection`),
 * and each section's type is the value it reads (`types.ts`). A section or field added here
 * is read, typed and documented with no further work.
 *
 * The sections are the ones the researched modes change between them
 * (/mnt/project-files/game-modes/what-modes-change.md). Each is data (characters, numbers) or
 * a choice from a fixed set of behaviours, never rules prose: the mode's own rules are linked,
 * not retold (no authored content, Trevor 2026-10-15).
 */
import {
	about,
	anyOf,
	B,
	CHARACTER,
	COUNT,
	list,
	NUM,
	obj,
	oneOf,
	opt,
	optObj,
	STR,
	STRS,
	variants,
	type FieldSpec,
	type SpecValue
} from '#lib/core/data/field-spec.ts';
import { SEATED, TYPES } from './guide-fields.ts';

const IDS = list(CHARACTER);

/** A page a mode or one of its sections comes from: its own title, or the site's name. */
export const LINK = obj({ title: STR, url: STR });
const LINKS = list(LINK);

/**
 * Fields every section carries: where its rule comes from, and what the Storyteller does for
 * it when the app doesn't run it, so the file alone says what a game needs (Trevor,
 * 2026-10-19: the JSON should be "self-sufficient for the storyteller"; required on such
 * sections, `validate.ts`).
 */
const CITED = { cite: opt(STR), instructions: opt(STR) };

/** One kind of a section: its `kind`, what it means, and its own fields. */
function kind<const K extends string, const F extends Parameters<typeof obj>[0]>(
	tag: K,
	text: string,
	fields: F
) {
	return {
		label: tag,
		tag,
		spec: about(text, obj({ kind: oneOf([tag] as const), ...fields, ...CITED }))
	};
}

/** A section with no kinds: these fields, plus `cite` and `instructions`. */
const section = <const F extends Parameters<typeof obj>[0]>(text: string, fields: F) =>
	about(text, obj({ ...fields, ...CITED }));

const counts = (text: string) =>
	about(text, optObj({ townsfolk: NUM, outsider: NUM, minion: NUM, demon: NUM }));

export const CAMPAIGN_ENDS = [
	'no-demons',
	'deathmatch',
	'domination',
	'first-blood',
	'attrition',
	'mercy',
	'rush',
	'stockpile',
	'fixed-games',
	'fixed-time',
	'endless'
] as const;

const POOL = about(
	'Which characters the game is played with.',
	variants(
		kind('script', 'The script chosen on New game (standard).', {}),
		kind('all-characters', 'Every official character; no script is chosen.', {
			types: opt(about('Only these types. Every seated type when left out.', anyOf(TYPES)))
		}),
		kind(
			'script-plus-hidden',
			'The chosen script plus hidden characters from off it, rolled or chosen on the Hidden characters screen.',
			{
				extras: counts(
					'How many hidden characters of each type, e.g. { "townsfolk": 1, "minion": 1 }. Each is a row the Storyteller may fill or leave empty.'
				),
				announceRange: about(
					'The Storyteller may tell the table a range of how many there are.',
					B
				),
				count: opt(
					about(
						'How many hidden characters in all, e.g. { "min": 1, "max": 4 }; `extras` is then the most of each type. Left out, every one in `extras` is added.',
						obj({ min: NUM, max: NUM })
					)
				)
			}
		),
		kind(
			'campaign',
			'A campaign: each game’s script is made from the last (betweenGames says how).',
			{
				startingScript: about('The first game’s script.', oneOf(['any']))
			}
		),
		kind('per-town', 'One script per town (towns).', {
			scripts: about(
				'Each town’s script, loaded from its page (BotC Scripts links work). Empty: chosen on New game.',
				LINKS
			)
		})
	)
);

const RESTRICTED = section(
	'Characters the mode keeps out. The Storyteller can add to these or lift them for each game.',
	{
		banned: about('Never in the game.', IDS),
		notChoosable: opt(about('May be in play, but no player is offered or chooses them.', IDS)),
		onlyFor: opt(
			about(
				'Only a player dealt this type may take the character (Whale Buffet: Summoner for a Demon).',
				list(obj({ characterId: CHARACTER, type: oneOf(SEATED) }))
			)
		)
	}
);

const COUNTS = about(
	'How many of each character type.',
	variants(
		kind('standard', 'The setup table’s counts.', {}),
		kind('per-town', 'Standard counts for each town’s players, towns as even as possible.', {
			maxDifference: about('The most players one town may have over another.', NUM)
		})
	)
);

const SETUP_MODIFIERS = about(
	'Which [bracketed] setup abilities change the counts.',
	variants(
		kind('standard', 'All of them.', {}),
		kind('only', 'Only these characters’ setup changes apply.', {
			characters: about('The characters.', IDS)
		}),
		kind(
			'as-chosen',
			'Applied as each is drafted; the Storyteller decides once a count is set.',
			{}
		)
	)
);

const ASSIGNMENT = about(
	'How characters reach players.',
	variants(
		kind('bag', 'Drawn from the bag (standard).', {}),
		kind('draft', 'Each player in turn is offered characters from the tile bag and keeps one.', {
			offers: about(
				'The size of each offer in turn; refusing moves to the next (3, 2, 1).',
				list(COUNT)
			),
			recycleUnchosen: about(
				'Characters not kept go back in the pool instead of being discarded.',
				B
			),
			oneTypePerOffer: about('Every character in one offer is of one type.', B)
		}),
		kind('choose-own', 'The bag deals a character type; each player chooses a character of it.', {
			when: about('When they choose.', oneOf(['first-night'])),
			reconsider: about('The Storyteller may ask a player to choose again.', B)
		})
	)
);

const DUPLICATES = about(
	'Several players with the same character.',
	variants(
		kind('standard', 'Only where a character’s rules allow it.', {}),
		kind('allowed', 'Any character may be dealt more than once.', {
			extrasMayBeDrunk: about('Extra copies may be drunk.', B),
			notTypes: opt(
				about(
					'These types still have one copy each. Every type repeats when left out.',
					anyOf(SEATED)
				)
			)
		})
	)
);

const FORCED = section(
	'Characters always in the game. Those in play are put in setup’s selection; the Storyteller can still take one out.',
	{
		inPlay: opt(about('Always dealt to a player.', IDS)),
		onScript: opt(about('Always on the script, in play or not.', IDS)),
		ruleCharacters: opt(
			about('Fabled or Loric always in the game (run by the Storyteller for now).', IDS)
		),
		homebrew: opt(
			about(
				'A homebrew rule character the mode needs, by its rules page (run by the Storyteller).',
				LINKS
			)
		)
	}
);

/** Rules the Storyteller runs by hand: which characters, if any, and where to read them. */
const linked = (text: string) =>
	about(text, list(section(text, { characters: opt(about('The characters, if any.', IDS)) })));

const RULE_CHANGES = linked(
	'Characters whose rules the mode changes. The Storyteller runs them from the linked page.'
);
const INFORMATION = linked(
	'Extra information the mode gives. The Storyteller runs it from the linked page.'
);

/**
 * `none` when the Demon learns no not-in-play characters (Trevor, 2026-10-18: Sushi Buffet
 * and Whale Buffet have no Demon bluffs).
 */
const BLUFFS = about(
	'Whether the Demon learns bluffs.',
	variants(
		kind('standard', 'Three not-in-play characters, as usual.', {}),
		kind('none', 'The Demon learns no bluffs.', {})
	)
);

const DAY_STEPS = about(
	'Steps added to each day.',
	list(
		variants(
			kind(
				'town-representative',
				'A nominated representative moves players to the other town at the end of each day.',
				{
					movesPerDay: about('Players moved at the end of day 1, day 2, and so on.', list(NUM))
				}
			),
			kind(
				'spectator-vote',
				'Spectators (phones in the room without a seat) vote on how their shared ability is used.',
				{
					ability: opt(about('The ability’s name, e.g. Apparition.', STR)),
					when: opt(about('When they vote.', oneOf(['each-dawn']))),
					pick: opt(about('What they vote for.', oneOf(['player']))),
					grants: opt(about('The chosen player gains these characters’ abilities.', IDS)),
					lasts: opt(about('How long it lasts.', oneOf(['until-next-dawn'])))
				}
			)
		)
	)
);

const WIN_CONDITIONS = about(
	'How the game is won.',
	variants(
		kind('standard', 'As usual.', {}),
		kind(
			'demon-executed',
			'As usual, and good also wins as soon as any Demon dies by execution.',
			{}
		),
		kind('all-towns', 'A team wins by winning every town.', {
			splitTiebreak: about(
				'If the towns split after day afterDay, winner (good or evil) wins when the together characters are in one town, else the other team does.',
				obj({ afterDay: NUM, together: IDS, winner: oneOf(['good', 'evil']) })
			)
		})
	)
);

const TOWNS = section(
	'More than one town (grimoire) in one game. Each town is its own saved game, opened from the towns page.',
	{
		count: about('How many towns.', NUM),
		storytellers: about('How many Storytellers.', NUM),
		samePlayers: opt(
			about('Every player plays in every town at once, with a character in each.', B)
		),
		notInEveryTown: opt(
			about('No player has a character of these types in every town.', anyOf(SEATED))
		),
		inPlay: opt(
			about(
				'Characters always in play in each town, by town: [["boomdandy"], ["mayor"]].',
				list(IDS)
			)
		)
	}
);

const PARTICIPANTS = section('People taking part without a seat.', {
	spectators: about(
		'Spectators share one ability (daySteps spectator-vote).',
		oneOf(['shared-ability'])
	)
});

const BETWEEN_GAMES = about(
	'What happens between games of a campaign, on the campaign page.',
	variants(
		kind('campaign', 'Executed characters are eliminated for the rest of the campaign.', {
			eliminate: about(
				'Which executed characters are eliminated.',
				oneOf(['every-executed', 'last-executed'])
			),
			replaceSameType: about('Each is replaced by an available character of the same type.', B),
			target: about(
				'The script each game aims for: how many of each type.',
				obj({ townsfolk: NUM, outsider: NUM, minion: NUM, demon: NUM })
			),
			growDemons: about('One Demon is added per game until target.demon.', B),
			endConditions: about(
				'When the campaign ends. The app ends it on no-demons; the others are the Storyteller’s.',
				anyOf(CAMPAIGN_ENDS)
			)
		})
	)
);

const TEXT = about(
	'The rule’s own lines, shown on the Bootlegger. A script’s Bootlegger lines become a rule with only this section.',
	STRS
);

const TRAVELLERS = section('Travellers dealt from the bag like other characters.', {
	inBag: about(
		'At most this many Travellers in the bag. The other counts are for that many fewer players.',
		NUM
	),
	announced: about('Whether the table is told who the Travellers are.', B)
});

const SEATS = about(
	'Seats dealt a character that no one plays.',
	variants(
		kind('storyteller-seat', 'The Storyteller holds the seat.', {
			count: about('How many such seats.', COUNT),
			speaks: about(
				'Whether the Storyteller may speak for the seat: once a game, or once privately and once publicly.',
				oneOf(['never', 'once-per-game', 'private-and-public'])
			),
			votes: opt(
				about(
					'Whether the Storyteller may add the seat’s vote to one nomination a day, while it still has a vote.',
					oneOf(['once-per-day'])
				)
			)
		})
	)
);

const DEATHS = about(
	'How deaths are announced.',
	variants(
		kind(
			'private',
			'The Storyteller doesn’t announce deaths; the players’ view doesn’t show them.',
			{}
		)
	)
);

/**
 * Every section a file can set, in the order Inspect and the guide show them: the game mode
 * sections, then those that began as a special rule's own (any file may set them since
 * 2026-11-01, Trevor: one format for both).
 */
export const SETUP_SPECS = {
	pool: POOL,
	restricted: RESTRICTED,
	counts: COUNTS,
	setupModifiers: SETUP_MODIFIERS,
	assignment: ASSIGNMENT,
	duplicates: DUPLICATES,
	forced: FORCED,
	ruleChanges: RULE_CHANGES,
	information: INFORMATION,
	bluffs: BLUFFS,
	daySteps: DAY_STEPS,
	winConditions: WIN_CONDITIONS,
	towns: TOWNS,
	participants: PARTICIPANTS,
	betweenGames: BETWEEN_GAMES,
	text: TEXT,
	travellers: TRAVELLERS,
	seats: SEATS,
	deaths: DEATHS
} as const satisfies Record<string, FieldSpec>;

/** The value a section reads. */
export type SectionValue<K extends keyof typeof SETUP_SPECS> = SpecValue<(typeof SETUP_SPECS)[K]>;

/** A source link's value. */
export type LinkValue = SpecValue<typeof LINK>;
