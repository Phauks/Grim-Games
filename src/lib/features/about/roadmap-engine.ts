/** The engine's features: the rules the app plays by. Part of the roadmap (roadmap.ts). */
import type { RoadmapItem } from './roadmap.ts';

export const ENGINE: readonly RoadmapItem[] = [
	{
		title:
			'Custom characters that follow their own rules: kill, protect, drunk and poison, win conditions, night information',
		area: 'engine',
		parts: ['L74'],
		prs: [410, 420, 429, 445, 459, 460, 462, 463, 465, 472, 482, 485, 488, 491]
	},
	{
		// Trevor, 2026-10-30/31: chosen at the start, shown on or off with the special rules.
		title: "Characters' optional rules, chosen at the start of the game",
		area: 'engine',
		parts: ['M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M14']
	},
	{
		// The ability parts gap list (/mnt/project-files/ability-parts/gaps.md), gaps 2 to 5.
		title:
			"Every official character's ability as data: night information, character and alignment changes, abilities held without a token",
		area: 'engine',
		parts: [
			'L70',
			'L71',
			'L72',
			'L73',
			'L75',
			'L76',
			'L77',
			'L78',
			'L79',
			'L80',
			'L81',
			'L83',
			'L84',
			'L85',
			'L86',
			'L87',
			'L88',
			'L89',
			'L90',
			'L91',
			'L92',
			'L93',
			// Small token Option A (Trevor, 2026-10-31): who a player really is, marked =.
			'L101'
		],
		prs: [828, 833, 838, 841, 843, 846, 847, 849, 851, 853, 855, 857]
	},
	{
		// Gap 2: characters whose information the Storyteller still works out by hand. M10a
		// Chambermaid, M10b Puzzlemaster, M10c Widow, M10d Damsel, M10e Storm Catcher, M10f Zenomancer, M10g the Storm Catcher's named character saved.
		title:
			'Valid information for the Chambermaid, Puzzlemaster, Widow, Damsel, Storm Catcher and Zenomancer',
		area: 'engine',
		parts: ['M10a', 'M10b', 'M10c', 'M10d', 'M10e', 'M10f', 'M10g']
	},
	{
		// Trevor, 2026-11-02: the Correct reminder goes on whoever was guessed right (the Juggler
		// too, one player more than once, or nobody); the Juggler learns how many are placed.
		title: "The Juggler's number from the Correct reminders on the board",
		area: 'engine',
		parts: ['M19']
	},
	{
		// Trevor, 2026-11-02: when the Imp kills itself with several Minions alive, the Scarlet
		// Woman stands out as the new Imp while her ability applies; any Minion can still be chosen.
		title: 'The Scarlet Woman stands out when choosing the new Demon',
		area: 'engine',
		parts: ['M23']
	},
	{
		// Gap 8: the Bigwig's chosen speaker; gap 12: one-offs with no behaviour yet: M12a the
		// Scapegoat, M12b the Boomdandy, M12c the Courtier's countdown.
		title: "The Bigwig's speaker, the Scapegoat, the Boomdandy and the Courtier's three nights",
		area: 'engine',
		parts: ['M11', 'M12a', 'M12b', 'M12c']
	},
	{
		// Gaps 5 and 12: one-off abilities and game rules nothing read yet (thread "Automate
		// one-off characters and unread rules", 2026-11-01). M15a Toymaker, M15b Buddhist, M15c
		// Barista, M15d Doomsayer, M15e Fibbin, M15f Duchess, M15g Vigormortis, M15h Lleech, M15i
		// Amnesiac, M15j Summoner.
		title:
			"The Toymaker's skipped attack, the Buddhist's quiet veterans, the Barista's doubled ability, and more one-off characters",
		area: 'engine',
		parts: [
			'M15a',
			'M15b',
			'M15c',
			'M15d',
			'M15e',
			'M15f',
			'M15g',
			'M15h',
			'M15i',
			'M15j',
			// Gaps the wiki examples found: M15k night wakes, M15l game ends, M15m protection and
			// exile, M15n night information, M15o character changes and held abilities.
			'M15k',
			'M15l',
			'M15m',
			'M15n',
			'M15o'
		]
	},
	{
		// Trevor, 2026-11-02: "just let them set what character they are, but not location for now".
		title:
			'The Gardener: the Storyteller sets each character on the board, and players with no phone still see theirs',
		area: 'engine',
		parts: ['M16']
	},
	{
		// Gap 1, last and separate (Trevor, 2026-10-28). M9a the vote record and vote weights
		// (Thief, Bureaucrat, God of Ug, Butler, Zealot, Beggar), M9b voting across the table
		// (Voudon, Organ Grinder, Ferryman), M9c who may nominate (Bishop, Golem, Gnome), M9d
		// forced and failed executions (Legion, Judge, Vizier, Cult Leader), M9e vote notes for the
		// Storyteller's count (Trevor, 2026-11-01: votes are run outside the app, never recorded).
		title:
			'Voting and nominations: vote weight, who may vote or nominate, forced and blocked executions (Butler, Thief, Bureaucrat, Bishop, Legion and 12 more)',
		area: 'engine',
		parts: ['M9a', 'M9b', 'M9c', 'M9d', 'M9e']
	},
	{
		// The wiki examples each character's test file lists as still to do, a batch per edition
		// (M13b Trouble Brewing). Examples the engine can't pass yet are written as it.fails.
		title: 'Every wiki example tested, for every character',
		area: 'engine',
		parts: ['M13a', 'M13b', 'M13']
	},
	{
		// Wiki example gaps no other thread owned (Nov 2): M17a Knaves, M17b Wizard, M17c
		// Yaggababble, M17d Ojo, M17e Al-Hadikhia, M17f Angel, M17g Savant.
		title:
			"The Knaves' lying Storyteller, the Wizard's wishes, the Yaggababble's phrase, the Ojo, the Al-Hadikhia, the Angel's punishment and the Savant's statements about people",
		area: 'engine',
		parts: ['M17a', 'M17b', 'M17c', 'M17d', 'M17e', 'M17f', 'M17g']
	},
	{
		// Setup rules audit (Trevor, 2026-11-02): every bracketed setup change covered, starting
		// with the Bounty Hunter's evil Townsfolk, picked, checked at Start game and told.
		title: 'Every setup change covered: the Bounty Hunter makes a Townsfolk evil, and more',
		area: 'engine',
		parts: ['M22']
	},
	{
		// Trevor, 2026-11-01: every "You are" and character token a night step shows is filled in
		// with the right character (the Snake Charmer's, the Evil Twin's, the Cerenovus's).
		title: 'Night steps fill in every info token with the right character',
		area: 'engine',
		parts: ['M18']
	},
	{
		// Trevor, 2026-11-02: the Snake Charmer's night step does the whole swap with the Demon it
		// chooses, a Philosopher with its ability swaps too, and the No Dashii's poison follows.
		title: "The Snake Charmer's swap with the Demon, done in its night step",
		area: 'engine',
		parts: ['M20']
	},
	{
		// The nomination rules the wiki examples still waited on (Witch, Vigormortis, Golem, Riot,
		// Bishop, Boffin, Butcher, Judge examples): a cursed nominator dies, nominees who die on the
		// Riot's day 3 nominate, the Golem nominates once a game, the Butcher's extra execution,
		// and abilities the Boffin gives the Demon act on nominations.
		title:
			"Nomination abilities: the Witch's curse, the Riot's day 3, the Golem's one nomination and the Butcher's second execution",
		area: 'engine',
		parts: ['M24']
	},
	{
		// The coordinator's ask of 2026-11-02: the How to Run tests that waited on timing rules.
		// The Monk's Safe comes off at dawn and the Poisoner's Poisoned at dusk, a player safe from
		// the Demon is safe from its poison too, the Undertaker counts only today's executions,
		// and only the first nomination of the Virgin sets it off.
		title: 'Monk, Soldier, Poisoner, Undertaker and Virgin follow their full timing rules',
		area: 'engine',
		parts: ['M25']
	},
	{
		// Trevor, 2026-11-02: every How to Run gap closed before beta goes to production. Reminders
		// that never came off now do: at dawn, at dusk, at dusk tomorrow (the Minstrel) or when
		// their player dies (the Philosopher), and the Po's and Shabaloth's night text says which
		// token comes off.
		title: 'Reminders come off on time: the Innkeeper, Witch, Minstrel, Philosopher and more',
		area: 'engine',
		parts: ['M27']
	},
	{
		// Trevor, 2026-11-02: in an Atheist game the Storyteller still gets guidance. M26a a pretend
		// evil team in the engine, with information that fits it; M26b its seat sheet row, night
		// steps and board mark.
		title: 'Atheist games: a fake evil team, with night steps and information that fit it',
		area: 'engine',
		parts: ['M26a', 'M26b']
	},
	{
		// Trevor, 2026-11-03: "Whole-game run-throughs". A Trouble Brewing, Bad Moon Rising and
		// Sects and Violets game played night by night through the engine as tests, to find what
		// goes wrong between characters over a game.
		title: 'Whole games of each base script checked night by night',
		area: 'engine',
		parts: ['M42']
	},
	{
		// The coordinator's ask of 2026-11-02 (Trevor: no release until the How to Run gaps are
		// closed): a once-per-game character stops waking once marked No Ability, the Zombuul
		// sleeps while anyone is marked Died Today, the Bounty Hunter wakes when its Know player
		// dies, the Juggler only after the first day, a Wraith without its ability sleeps.
		title: 'Characters stop waking once their ability is used or no longer works',
		area: 'engine',
		parts: ['M28']
	},
	{
		// Trevor, 2026-11-02: every How to Run gap closed before beta goes to production. M32a the
		// Hell's Librarian's picked Something Bad, the Pit-Hag's deaths once it makes a Demon, the
		// Apprentice's gained ability and the Hatter's tea party after the Hatter dies; M32b the
		// Fiddler's contest (the Demon's opponent, evil wins a tie) and an evil Politician who wins
		// with good, in the engine; M32c End game runs the fiddle contest; M32d End game marks a
		// Politician who wins too.
		title:
			"Fiddler, Hatter, Pit-Hag, Apprentice, Politician and Hell's Librarian follow their full How to Run",
		area: 'engine',
		parts: ['M32a', 'M32b', 'M32c', 'M32d']
	},
	{
		// The coordinator's ask of 2026-11-03: the Storyteller gives a player an ability without
		// changing their character. M34 the engine: an ability recorded by hand, or the one the
		// player's own character chose (the Philosopher's), is held and wakes at its step.
		title: 'Give ability engine support',
		area: 'engine',
		parts: ['M34']
	},
	{
		// Trevor, 2026-11-04: official characters run as custom ones (engine-audit/engine-parity-audit.md).
		// M57 parity check, M58 quick fixes, M59 night position, M60 building blocks, M61 one vocabulary,
		// M62 rules in the Character builder.
		title: 'Custom characters can do everything official ones can',
		area: 'engine',
		parts: ['M57', 'M58', 'M59', 'M60', 'M61', 'M62']
	},
	{
		// The coordinator's ask of 2026-11-03 (ability-parts/jinx-format-audit.md): a jinx format a
		// custom script can write. M39 general verbs with shared `when` conditions and `who`, so a
		// rule may sit in either character's file; M40 rules on a script's own jinxes, which
		// replace TPI's for the pair (`rulesForJinx`), with load warnings for rules the app
		// can't use; M41 the three official jinxes the format couldn't say: the Storyteller picks
		// Lil' Monsta's babysitter with the Magician, the Minions wake one at a time with the Poppy
		// Grower (`storytellerChooses` a carrier, now `wakes`, on Lil' Monsta's own step), and
		// the Ogre learns it is evil from the Recluse (`learns` with an alignment condition).
		// M44 the gaps the blind re-run found: `not`, dead, executed and third-character
		// conditions; `cannotChoose`, a choice that stops a kill, the Storyteller choosing another
		// player, learning a true character; an `executed` game end checked at the execution, and
		// the final day with no fixed day; load warnings for rules that can change nothing.
		// M46 full parity: a jinx protection ("the Gloom cannot kill the Lamplighter"), and the
		// values written for one official pair turned into general shapes a custom script can
		// reuse for any pair, most of them the character part of the same name (saved game
		// version 30 turns the old values in a saved script into the new ones).
		title: 'Jinx format for custom scripts',
		area: 'engine',
		parts: ['M39', 'M40', 'M41', 'M44', 'M46']
	},
	{
		// Trevor, 2026-11-02: beta goes to production only once the How to Run gaps are closed.
		// M29a and M29b the warnings still missing (a second Alsaahir guess, a fourth Matron swap,
		// the Goon's Drunk, the Pope's duplicate bluffs and more), M30a and M30b the info tokens
		// and prompts (the Hatter's and King's tokens, the Beggar's alignment, the Sage's Demon),
		// M31 the night order (Lil' Monsta's, the Poppy Grower's evil info, the Professor's revival).
		title: 'Every How to Run step covered: missing warnings, info tokens and night steps',
		area: 'engine',
		parts: ['M29a', 'M29b', 'M30a', 'M30b', 'M31']
	},
	{
		// Trevor, 2026-10-30: on the roadmap, after a spike and research. L99 research, L100 the
		// format with the Heretic and Boffin, L107 every jinx shown where it matters, L108 jinxes
		// that reuse existing rules, L109 the Plague Doctor's and other built characters', L112
		// the Leviathan's and Riot's game ends, King, late Demon and night choices, L113 the
		// setup jinx gaps (the Damsel's Poisoned, the Alchemist's Summoner and Marionette), L114
		// the jinxes where a player learns something (the Cannibal's Butler, Zealot and Juggler,
		// the Vortox's Banshee), L115 the Vizier's six (not declared, kept protection, woken with
		// the Fearmonger, the Magician).
		// L116 Lil' Monsta's babysitting jinxes (the Hatter, Magician, Poppy Grower, Psychopath,
		// Scarlet Woman and Vizier). L117 Legion's (every evil player becomes Legion, the Engineer
		// and Hatter with no ability, Legion keeps their ability from the Minstrel and Preacher,
		// the Magician's Demon info). L118 the Summoner's (the Storyteller has its ability with
		// the Courtier, Engineer and Preacher, arbitrary deaths with the Hatter, Kazali and
		// Pit-Hag, the Lord of Typhon's neighbours, the Poppy Grower, the Pukka a night early).
		// L119 the Alchemist's and the remaining one-off jinxes (the Alchemist-Spy, -Widow,
		// -Wraith and -Mastermind with no ability, the guess that makes the Demon choose, the
		// Organ Grinder both drunk, the Boffin, the Alchemist-Summoner dying first; the Scarlet
		// Woman with no second Demon; the Mastermind's Vigormortis, Lleech and Al-Hadikhia; the
		// Slayer's Lleech host; the Marionette's Balloonist, Huntsman and Magician; the Cerenovus's
		// Goblin; the Butler with eyes closed; the Philosopher's Bounty Hunter).
		// L120 the Mathematician's four (the Drunk's and Marionette's false info and the Lunatic
		// attacking another player count as abnormal; the Chambermaid detects its waking).
		// L121 the Alchemist-Summoner makes the Demon on night 3, choosing only which Demon, with
		// no bluffs; a borrowed ability (the Alchemist's, the Boffin's, the Pixie's) runs where
		// the character's own does (`abilityHolders`).
		title: 'Jinxes the app applies, not only shows',
		area: 'engine',
		parts: [
			'L99',
			'L100',
			'L107',
			'L108',
			'L109',
			'L112',
			'L113',
			'L114',
			'L115',
			'L116',
			'L117',
			'L118',
			'L119',
			'L120',
			'L121'
		]
	}
];
