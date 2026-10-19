/**
 * How to write a game mode file (Trevor, 2026-10-18: instructions that cover every aspect of
 * the format, kept up to date at all times). The guide on New game's Add mode dialog is
 * drawn from this, and `format-guide.test.ts` fails when a part, field or kind the format
 * uses isn't described here, or when the format changes without `GAME_MODE_REVISION` going
 * up.
 */
import {
	CAMPAIGN_ENDS,
	GAME_MODE_FORMAT,
	MODE_PARTS,
	RULE_PARTS,
	SPECIAL_RULE_FORMAT,
	STACKING_PARTS,
	type ModePart,
	type RuleOnlyPart
} from './types.ts';

/**
 * The rolling revision of the format while it is developed (Trevor, 2026-10-18): it goes up
 * with every change to the format, however small. A numbered version replaces it at launch.
 * A file may say which revision it was written for in `revision`; it is read either way.
 */
export const GAME_MODE_REVISION = 9;

export interface GuideField {
	name: string;
	/** How the value is written, e.g. "text", "true or false", "list of character ids". */
	type: string;
	required: boolean;
	/** What it means, and what happens when it is left out. */
	about: string;
	/** The values it may take, when it is one of a few. */
	values?: readonly string[];
}

export interface GuideKind {
	kind: string;
	about: string;
	fields: GuideField[];
}

export interface GuidePart {
	part: ModePart | RuleOnlyPart;
	/** One object, or a list of them. */
	list: boolean;
	about: string;
	/** Fields every kind of this part has (besides `cite` and `instructions`, which every part has). */
	fields: GuideField[];
	kinds: GuideKind[];
}

const CITE: GuideField = {
	name: 'cite',
	type: 'https link',
	required: false,
	about: 'The page this part comes from, when it is not the mode’s first source.'
};

/** Required, from revision 8, on a part the app doesn't run (validate.ts). */
const INSTRUCTIONS: GuideField = {
	name: 'instructions',
	type: 'text',
	required: false,
	about:
		'What the Storyteller does for this part. Required on a part Inspect shows as run by the Storyteller, so the file alone says what the game needs.'
};

const IDS = 'list of character ids';
const SEATED = ['townsfolk', 'outsider', 'minion', 'demon'] as const;
const TYPES = [...SEATED, 'traveller', 'fabled', 'loric'] as const;
const counts = (about: string): GuideField[] =>
	SEATED.map((type) => ({ name: type, type: 'whole number', required: false, about }));

export const GUIDE_INTRO = [
	'A game mode is one JSON object. Paste it, or open a .json file, in Add mode. Every problem is listed with where it is (for example parts.assignment.offers), so a file can be fixed in one go.',
	'Start from a built-in mode: Inspect any mode on the Game modes tab shows its whole file.',
	'Character ids are the official ones, lower case with no spaces or dashes (pithag, bountyhunter). Unknown ids are refused.',
	'Every part is optional. A part left out is played as standard, and the app runs it. A part the app can’t run yet is shown in Inspect as run by the Storyteller.',
	'Links must start with https://. A mode names its sources, if a page describes it, and an author only with a link to a page that names them.'
];

/** The fields of the mode object itself. */
export const GUIDE_TOP: GuideField[] = [
	{
		name: 'format',
		type: 'number',
		required: true,
		about: `Always ${GAME_MODE_FORMAT}. It changes only when old files can no longer be read as they are.`
	},
	{
		name: 'revision',
		type: 'whole number',
		required: false,
		about: `The revision of this guide the file was written for (now ${GAME_MODE_REVISION}). Read either way; it helps say why an older file fails.`
	},
	{
		name: 'id',
		type: 'text',
		required: true,
		about:
			'Lower-case letters, digits and dashes (my-mode). It must not be a built-in mode’s id. Adding a file with the id of one of yours replaces it.'
	},
	{ name: 'name', type: 'text', required: true, about: 'The name the mode is known by.' },
	{
		name: 'aliases',
		type: 'list of text',
		required: false,
		about: 'Other names it goes by. Shown in Inspect.'
	},
	{
		name: 'about',
		type: 'text',
		required: false,
		about:
			'A short description of how it plays, shown under the mode when Show our own wording is on.'
	},
	{
		name: 'sources',
		type: 'list of links',
		required: true,
		about:
			'Where the rules come from, the rules page first: each { "title": "…", "url": "https://…" }. May be [] for a mode of your own that no page describes.'
	},
	{
		name: 'authors',
		type: 'list of links',
		required: false,
		about:
			'Who made the mode: each { "title": name, "url": a page that names them as its author }. Leave it out when no page says who made it. People only thanked are not authors.'
	},
	{
		name: 'unconfirmed',
		type: 'list of part names',
		required: false,
		about: 'Parts no source confirms. Inspect marks them.',
		values: MODE_PARTS
	},
	{
		name: 'parts',
		type: 'object',
		required: true,
		about: 'What the mode changes, by part (below). May be empty: {} is a standard game.'
	}
];

export const GUIDE_PARTS: GuidePart[] = [
	{
		part: 'pool',
		list: false,
		about: 'Which characters the game is played with.',
		fields: [],
		kinds: [
			{ kind: 'script', about: 'The script chosen on New game (standard).', fields: [] },
			{
				kind: 'all-characters',
				about: 'Every official character; no script is chosen.',
				fields: [
					{
						name: 'types',
						type: 'list of character types',
						required: false,
						about: 'Only these types. Every seated type when left out.',
						values: TYPES
					}
				]
			},
			{
				kind: 'script-plus-hidden',
				about:
					'The chosen script plus hidden characters from off it, rolled or chosen on the Hidden characters screen.',
				fields: [
					{
						name: 'extras',
						type: 'object of counts by type',
						required: true,
						about: 'How many hidden characters of each type, e.g. { "townsfolk": 1, "minion": 1 }.'
					},
					{
						name: 'announceRange',
						type: 'true or false',
						required: true,
						about: 'The Storyteller may tell the table a range of how many there are.'
					},
					{
						name: 'count',
						type: 'object { "min", "max" }',
						required: false,
						about:
							'How many hidden characters in all, e.g. { "min": 1, "max": 4 }; `extras` is then the most of each type. Left out, every one in `extras` is added.'
					}
				]
			},
			{
				kind: 'campaign',
				about: 'A campaign: each game’s script is made from the last (betweenGames says how).',
				fields: [
					{
						name: 'startingScript',
						type: 'text',
						required: true,
						about: 'The first game’s script.',
						values: ['any']
					}
				]
			},
			{
				kind: 'per-town',
				about: 'One script per town (towns).',
				fields: [
					{
						name: 'scripts',
						type: 'list of links',
						required: true,
						about:
							'Each town’s script, loaded from its page (BotC Scripts links work). Empty: chosen on New game.'
					}
				]
			}
		]
	},
	{
		part: 'restricted',
		list: false,
		about:
			'Characters the mode keeps out. The Storyteller can add to these or lift them for each game.',
		fields: [
			{ name: 'banned', type: IDS, required: true, about: 'Never in the game.' },
			{
				name: 'notChoosable',
				type: IDS,
				required: false,
				about: 'May be in play, but no player is offered or chooses them.'
			},
			{
				name: 'onlyFor',
				type: 'list of { characterId, type }',
				required: false,
				about:
					'Only a player dealt this type may take the character (Whale Buffet: Summoner for a Demon).'
			}
		],
		kinds: []
	},
	{
		part: 'counts',
		list: false,
		about: 'How many of each character type.',
		fields: [],
		kinds: [
			{ kind: 'standard', about: 'The setup table’s counts.', fields: [] },
			{
				kind: 'per-town',
				about: 'Standard counts for each town’s players, towns as even as possible.',
				fields: [
					{
						name: 'maxDifference',
						type: 'whole number',
						required: true,
						about: 'The most players one town may have over another.'
					}
				]
			}
		]
	},
	{
		part: 'setupModifiers',
		list: false,
		about: 'Which [bracketed] setup abilities change the counts.',
		fields: [],
		kinds: [
			{ kind: 'standard', about: 'All of them.', fields: [] },
			{
				kind: 'only',
				about: 'Only these characters’ setup changes apply.',
				fields: [{ name: 'characters', type: IDS, required: true, about: 'The characters.' }]
			},
			{
				kind: 'as-chosen',
				about: 'Applied as each is drafted; the Storyteller decides once a count is set.',
				fields: []
			}
		]
	},
	{
		part: 'assignment',
		list: false,
		about: 'How characters reach players.',
		fields: [],
		kinds: [
			{ kind: 'bag', about: 'Drawn from the bag (standard).', fields: [] },
			{
				kind: 'draft',
				about: 'Each player in turn is offered characters from the tile bag and keeps one.',
				fields: [
					{
						name: 'offers',
						type: 'list of whole numbers',
						required: true,
						about: 'The size of each offer in turn; refusing moves to the next (3, 2, 1).'
					},
					{
						name: 'recycleUnchosen',
						type: 'true or false',
						required: true,
						about: 'Characters not kept go back in the pool instead of being discarded.'
					},
					{
						name: 'oneTypePerOffer',
						type: 'true or false',
						required: true,
						about: 'Every character in one offer is of one type.'
					}
				]
			},
			{
				kind: 'choose-own',
				about: 'The bag deals a character type; each player chooses a character of it.',
				fields: [
					{
						name: 'when',
						type: 'text',
						required: true,
						about: 'When they choose.',
						values: ['first-night']
					},
					{
						name: 'reconsider',
						type: 'true or false',
						required: true,
						about: 'The Storyteller may ask a player to choose again.'
					}
				]
			}
		]
	},
	{
		part: 'duplicates',
		list: false,
		about: 'Several players with the same character.',
		fields: [],
		kinds: [
			{ kind: 'standard', about: 'Only where a character’s rules allow it.', fields: [] },
			{
				kind: 'allowed',
				about: 'Any character may be dealt more than once.',
				fields: [
					{
						name: 'extrasMayBeDrunk',
						type: 'true or false',
						required: true,
						about: 'Extra copies may be drunk.'
					}
				]
			}
		]
	},
	{
		part: 'forced',
		list: false,
		about:
			'Characters always in the game. Those in play are put in setup’s selection; the Storyteller can still take one out.',
		fields: [
			{ name: 'inPlay', type: IDS, required: true, about: 'Always dealt to a player. May be [].' },
			{
				name: 'onScript',
				type: IDS,
				required: false,
				about: 'Always on the script, in play or not.'
			},
			{
				name: 'ruleCharacters',
				type: IDS,
				required: false,
				about: 'Fabled or Loric always in the game (run by the Storyteller for now).'
			},
			{
				name: 'homebrew',
				type: 'list of links',
				required: false,
				about:
					'A homebrew rule character the mode needs, by its rules page (run by the Storyteller).'
			}
		],
		kinds: []
	},
	{
		part: 'ruleChanges',
		list: true,
		about:
			'Characters whose rules the mode changes. The Storyteller runs them from the linked page.',
		fields: [
			{ name: 'characters', type: IDS, required: true, about: 'The characters. May be [].' }
		],
		kinds: []
	},
	{
		part: 'information',
		list: true,
		about: 'Extra information the mode gives. The Storyteller runs it from the linked page.',
		fields: [
			{ name: 'characters', type: IDS, required: true, about: 'The characters. May be [].' }
		],
		kinds: []
	},
	{
		part: 'bluffs',
		list: false,
		about: 'Whether the Demon learns bluffs.',
		fields: [],
		kinds: [
			{ kind: 'standard', about: 'Three not-in-play characters, as usual.', fields: [] },
			{ kind: 'none', about: 'The Demon learns no bluffs.', fields: [] }
		]
	},
	{
		part: 'daySteps',
		list: true,
		about: 'Steps added to each day.',
		fields: [],
		kinds: [
			{
				kind: 'town-representative',
				about: 'A nominated representative moves players to the other town at the end of each day.',
				fields: [
					{
						name: 'movesPerDay',
						type: 'list of whole numbers',
						required: true,
						about: 'Players moved at the end of day 1, day 2, and so on.'
					}
				]
			},
			{
				kind: 'spectator-vote',
				about:
					'Spectators (phones in the room without a seat) vote on how their shared ability is used.',
				fields: [
					{ name: 'ability', type: 'text', required: false, about: 'The ability’s name.' },
					{
						name: 'when',
						type: 'text',
						required: false,
						about: 'When they vote.',
						values: ['each-dawn']
					},
					{
						name: 'pick',
						type: 'text',
						required: false,
						about: 'What they vote for.',
						values: ['player']
					},
					{
						name: 'grants',
						type: IDS,
						required: false,
						about: 'The chosen player gains these characters’ abilities.'
					},
					{
						name: 'lasts',
						type: 'text',
						required: false,
						about: 'How long it lasts.',
						values: ['until-next-dawn']
					}
				]
			}
		]
	},
	{
		part: 'winConditions',
		list: false,
		about: 'How the game is won.',
		fields: [],
		kinds: [
			{ kind: 'standard', about: 'As usual.', fields: [] },
			{
				kind: 'all-towns',
				about: 'A team wins by winning every town.',
				fields: [
					{
						name: 'splitTiebreak',
						type: '{ afterDay, together, winner }',
						required: true,
						about:
							'If the towns split after day afterDay, winner (good or evil) wins when the together characters are in one town, else the other team does.'
					}
				]
			}
		]
	},
	{
		part: 'towns',
		list: false,
		about:
			'More than one town (grimoire) in one game. Each town is its own saved game, opened from the towns page.',
		fields: [
			{ name: 'count', type: 'whole number', required: true, about: 'How many towns.' },
			{
				name: 'storytellers',
				type: 'whole number',
				required: true,
				about: 'How many Storytellers.'
			},
			{
				name: 'samePlayers',
				type: 'true or false',
				required: false,
				about: 'Every player plays in every town at once, with a character in each.'
			},
			{
				name: 'notInEveryTown',
				type: 'list of character types',
				required: false,
				about: 'No player has a character of these types in every town.',
				values: SEATED
			},
			{
				name: 'inPlay',
				type: 'list of lists of character ids',
				required: false,
				about: 'Characters always in play in each town, by town: [["boomdandy"], ["mayor"]].'
			}
		],
		kinds: []
	},
	{
		part: 'participants',
		list: false,
		about: 'People taking part without a seat.',
		fields: [
			{
				name: 'spectators',
				type: 'text',
				required: true,
				about: 'Spectators share one ability (daySteps spectator-vote).',
				values: ['shared-ability']
			}
		],
		kinds: []
	},
	{
		part: 'betweenGames',
		list: false,
		about: 'What happens between games of a campaign, on the campaign page.',
		fields: [],
		kinds: [
			{
				kind: 'campaign',
				about: 'Executed characters are eliminated for the rest of the campaign.',
				fields: [
					{
						name: 'eliminate',
						type: 'text',
						required: true,
						about: 'Which executed characters are eliminated.',
						values: ['every-executed', 'last-executed']
					},
					{
						name: 'replaceSameType',
						type: 'true or false',
						required: true,
						about: 'Each is replaced by an available character of the same type.'
					},
					{
						name: 'target',
						type: 'object of counts by type',
						required: true,
						about: 'The script each game aims for.'
					},
					...counts('In target: how many of this type.'),
					{
						name: 'growDemons',
						type: 'true or false',
						required: true,
						about: 'One Demon is added per game until target.demon.'
					},
					{
						name: 'endConditions',
						type: 'list of text',
						required: true,
						about:
							'When the campaign ends. The app ends it on no-demons; the others are the Storyteller’s.',
						values: CAMPAIGN_ENDS
					}
				]
			}
		]
	}
];

/** A file that is a standard game with one character banned: the least a mode needs. */
export const MINIMAL_EXAMPLE = {
	format: GAME_MODE_FORMAT,
	revision: GAME_MODE_REVISION,
	id: 'no-pit-hag',
	name: 'No Pit-Hag',
	sources: [{ title: 'Our group’s house rules', url: 'https://example.com/house-rules' }],
	parts: { restricted: { banned: ['pithag'] } }
};

/**
 * How to write a special rule file (Trevor, 2026-10-18: game modes and special rules are
 * delineated, and both can be added). Same header as a mode, plus `kind`; the parts that add
 * to a game are written as in a mode, and these are the rule's own.
 */
export const RULE_GUIDE_INTRO = [
	'A special rule is one JSON object with "kind": "special-rule". A game has one game mode and any number of special rules, so a rule only adds to a game: it can’t change the pool to something other than the script, how characters are dealt, towns, or what happens between games.',
	`Besides its own parts below, a rule may set these game mode parts, written as in a mode: ${STACKING_PARTS.join(', ')}. A rule’s pool can only be script-plus-hidden.`,
	'When two chosen rules, or a rule and the mode, set the same one-answer part differently, New game warns and the Storyteller decides. Lists are joined and count changes add up.'
];

/** The fields of the rule object itself, where they differ from a mode's. */
export const RULE_GUIDE_TOP: GuideField[] = [
	{
		name: 'kind',
		type: 'text',
		required: true,
		about: 'Always special-rule. A file without it is read as a game mode.',
		values: ['special-rule']
	},
	{
		name: 'format',
		type: 'number',
		required: true,
		about: `Always ${SPECIAL_RULE_FORMAT}. It changes only when old files can no longer be read as they are.`
	},
	...GUIDE_TOP.filter((f) => !['format', 'unconfirmed', 'parts'].includes(f.name)),
	{
		name: 'unconfirmed',
		type: 'list of part names',
		required: false,
		about: 'Parts no source confirms. Inspect marks them.',
		values: RULE_PARTS
	},
	{
		name: 'conflictsWith',
		type: 'object',
		required: false,
		about:
			'{ "modes": [ids], "rules": [ids] }: modes and rules this one can’t sensibly be played with. Choosing both warns on New game.'
	},
	{
		name: 'parts',
		type: 'object',
		required: true,
		about: 'What the rule adds, by part (below and the game mode parts it may set).'
	}
];

const COUNT_OP: GuideField[] = [
	{
		name: 'type',
		type: 'text',
		required: true,
		about: 'The character type it changes.',
		values: SEATED
	},
	{
		name: 'values',
		type: 'list of whole numbers',
		required: true,
		about: 'The change, or the choices of change: [1] is +1, [0, 1] is +0 or +1.'
	}
];

export const RULE_GUIDE_PARTS: GuidePart[] = [
	{
		part: 'text',
		list: true,
		about:
			'The rule’s own lines, shown on the Bootlegger. A script’s Bootlegger lines become a rule with only this part.',
		fields: [],
		kinds: []
	},
	{
		part: 'countChanges',
		list: true,
		about:
			'Changes to how many of each character type, added to any others (a script’s [+1 Demon]).',
		fields: [],
		kinds: [
			{ kind: 'delta', about: 'Add one of the values.', fields: COUNT_OP },
			{
				kind: 'set',
				about: 'The count becomes one of the values.',
				fields: COUNT_OP
			},
			{
				kind: 'any',
				about: 'The Storyteller picks the count.',
				fields: COUNT_OP.slice(0, 1)
			}
		]
	},
	{
		part: 'travellers',
		list: false,
		about: 'Travellers dealt from the bag like other characters.',
		fields: [
			{
				name: 'inBag',
				type: 'whole number',
				required: true,
				about:
					'At most this many Travellers in the bag. The other counts are for that many fewer players.'
			},
			{
				name: 'announced',
				type: 'true or false',
				required: true,
				about: 'Whether the table is told who the Travellers are.'
			}
		],
		kinds: []
	},
	{
		part: 'seats',
		list: false,
		about: 'Seats dealt a character that no one plays.',
		fields: [],
		kinds: [
			{
				kind: 'storyteller-seat',
				about: 'The Storyteller holds the seat.',
				fields: [
					{ name: 'count', type: 'whole number', required: true, about: 'How many such seats.' },
					{
						name: 'speaks',
						type: 'text',
						required: true,
						about: 'Whether the Storyteller may speak for the seat.',
						values: ['never', 'once-per-game']
					}
				]
			}
		]
	},
	{
		part: 'deaths',
		list: false,
		about: 'How deaths are announced.',
		fields: [],
		kinds: [
			{
				kind: 'private',
				about: 'The Storyteller doesn’t announce deaths; the players’ view doesn’t show them.',
				fields: []
			}
		]
	},
	{
		part: 'nightSteps',
		list: true,
		about: 'Steps added to each night.',
		fields: [],
		kinds: [
			{
				kind: 'wake',
				about: 'These characters or types wake.',
				fields: [
					{
						name: 'when',
						type: 'text',
						required: true,
						about: 'Which nights.',
						values: ['each-night', 'each-night-except-first']
					},
					{ name: 'characters', type: IDS, required: false, about: 'Who wakes.' },
					{
						name: 'types',
						type: 'list of character types',
						required: false,
						about: 'Every character of these types wakes.',
						values: SEATED
					}
				]
			}
		]
	}
];

/** The least a special rule needs: one line of text. */
export const RULE_MINIMAL_EXAMPLE = {
	kind: 'special-rule',
	format: SPECIAL_RULE_FORMAT,
	revision: GAME_MODE_REVISION,
	id: 'house-rule',
	name: 'House rule',
	sources: [{ title: 'Our group’s house rules', url: 'https://example.com/house-rules' }],
	parts: { text: ['Our house rule.'] }
};

/** Every field name the guide describes, at any depth: for the test that keeps it current. */
export function documentedFields(): Set<string> {
	const names = new Set<string>(['kind', 'cite', 'title', 'url', 'characterId', 'type']);
	for (const f of [...GUIDE_TOP, ...RULE_GUIDE_TOP]) names.add(f.name);
	for (const part of RULE_PARTS) names.add(part);
	for (const part of MODE_PARTS) names.add(part);
	for (const extra of ['modes', 'rules']) names.add(extra);
	for (const p of [...GUIDE_PARTS, ...RULE_GUIDE_PARTS]) {
		for (const f of [...p.fields, CITE, INSTRUCTIONS]) names.add(f.name);
		for (const k of p.kinds) for (const f of k.fields) names.add(f.name);
	}
	for (const extra of ['afterDay', 'together', 'winner', 'min', 'max']) names.add(extra);
	return names;
}

/** The guide's shape, as one line: the test pins it to `GAME_MODE_REVISION`. */
export function guideFingerprint(): string {
	return [...GUIDE_PARTS, ...RULE_GUIDE_PARTS]
		.map(
			(p) =>
				`${p.part}:${p.fields.map((f) => f.name).join(',')}|${p.kinds
					.map((k) => `${k.kind}(${k.fields.map((f) => f.name).join(',')})`)
					.join(',')}`
		)
		.join(';');
}
