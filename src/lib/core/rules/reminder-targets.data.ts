/**
 * Where each reminder token may go (Trevor, 2026-10-16: show valid targets for every
 * token, e.g. the Vigormortis's "Has Ability" only on a Minion it killed). One entry per
 * official character with reminder tokens, one rule per TPI reminder label (a test checks
 * both). Read from each character's wiki page (`wiki`, its How to Run section and ability)
 * and paraphrased: `note` is our own summary, never wiki prose. `ambiguous` records what
 * the wiki leaves open, for Trevor to decide.
 *
 * A rule constrains the seat the token goes on, at the moment it is placed:
 * - `seat`: `self` only the character's own seat, `other` never it, `any` either;
 * - `types` / `characters`: the target's true character type, or true character;
 * - `alignment`: `good`/`evil`, or `same`/`opposite` to the character's player;
 * - `life`: whether the target is alive or dead when the token goes down;
 * - `neighbour`: the nearest seat each way from the character's own seat (`of: 'self'`)
 *   or from the seat carrying another of its tokens (`of: <label>`), or from a seat whose
 *   true character type is `ofType` (the Marionette sits next to the Demon). `type` skips
 *   seats of other types (the No Dashii's nearest Townsfolk); `alive` skips the dead;
 * - `withLabel` / `notWithLabel`: must share, or must not share, a seat with another of
 *   the character's tokens (the Washerwoman's Wrong is never on her Townsfolk);
 * - `global`: the token marks the game, never a player (the Riot's day count).
 *
 * The checks only suggest and warn (`reminder-targets.ts`); the Storyteller can put any
 * token anywhere.
 */
import type { Alignment, CharacterId, CharacterType } from '#lib/core/data/types.ts';

export interface NeighbourRule {
	/** `self`, or a label of this character's tokens whose seat is the centre. */
	of: 'self' | (string & {});
	/** Centre on seats whose true character has this type instead (the Demon). */
	ofType?: CharacterType;
	/** Only seats of this type count as neighbours; others are skipped. */
	type?: CharacterType;
	/** Skip dead players. */
	alive?: boolean;
}

export interface TargetRule {
	seat?: 'self' | 'other' | 'any';
	types?: readonly CharacterType[];
	characters?: readonly CharacterId[];
	alignment?: Alignment | 'same' | 'opposite';
	life?: 'alive' | 'dead';
	neighbour?: NeighbourRule;
	withLabel?: string;
	notWithLabel?: string;
	global?: boolean;
	note: string;
	ambiguous?: string;
}

export interface CharacterTargets {
	wiki: string;
	labels: Readonly<Record<string, TargetRule>>;
}

export const REMINDER_TARGETS: Readonly<Record<CharacterId, CharacterTargets>> = {
	steward: {
		wiki: 'https://wiki.bloodontheclocktower.com/Steward',
		labels: {
			Know: {
				seat: 'other',
				alignment: 'good',
				note: 'Marks the one good player the Steward is shown at setup.'
			}
		}
	},
	washerwoman: {
		wiki: 'https://wiki.bloodontheclocktower.com/Washerwoman',
		labels: {
			Townsfolk: {
				seat: 'other',
				types: ['townsfolk'],
				note: 'The Townsfolk whose character the Washerwoman is shown.'
			},
			Wrong: {
				seat: 'other',
				notWithLabel: 'Townsfolk',
				note: 'The second, decoy player pointed at alongside the Townsfolk.'
			}
		}
	},
	bountyhunter: {
		wiki: 'https://wiki.bloodontheclocktower.com/Bounty_Hunter',
		labels: {
			Know: {
				seat: 'other',
				alignment: 'evil',
				note: 'The evil player the Bounty Hunter currently knows; moves to a new evil player when they die.'
			}
		}
	},
	villageidiot: {
		wiki: 'https://wiki.bloodontheclocktower.com/Village_Idiot',
		labels: {
			Drunk: {
				seat: 'any',
				characters: ['villageidiot'],
				note: 'One of the Village Idiots, marking the extra one who is drunk.'
			}
		}
	},
	flowergirl: {
		wiki: 'https://wiki.bloodontheclocktower.com/Flowergirl',
		labels: {
			'Demon Not Voted': {
				seat: 'self',
				note: 'Kept on the Flowergirl from dawn until the Demon votes.'
			},
			'Demon Voted': {
				seat: 'self',
				note: 'Replaces the other token on the Flowergirl once the Demon has voted today.'
			}
		}
	},
	monk: {
		wiki: 'https://wiki.bloodontheclocktower.com/Monk',
		labels: {
			Safe: { seat: 'other', note: 'The player the Monk protects from the Demon tonight.' }
		}
	},
	lycanthrope: {
		wiki: 'https://wiki.bloodontheclocktower.com/Lycanthrope',
		labels: {
			Dead: {
				seat: 'any',
				alignment: 'good',
				note: 'A living good player the Lycanthrope chose, who dies.',
				ambiguous:
					'Neither the How to Run nor the summary says whether the Lycanthrope may choose themselves.'
			},
			'Faux Paw': {
				seat: 'any',
				alignment: 'good',
				note: 'The one good player set up to register as evil.',
				ambiguous:
					'The wiki does not say whether the Lycanthrope itself can be the Faux Paw player.'
			}
		}
	},
	courtier: {
		wiki: 'https://wiki.bloodontheclocktower.com/Courtier',
		labels: {
			'Drunk 1': {
				seat: 'any',
				note: 'The player of the in-play character the Courtier named, on the first night of drunkenness.'
			},
			'Drunk 2': { seat: 'any', note: 'Swapped onto the same drunk player on the second night.' },
			'Drunk 3': { seat: 'any', note: 'Swapped onto the same drunk player on the third night.' },
			'No Ability': { seat: 'self', note: 'On the Courtier once the drunkenness has ended.' }
		}
	},
	professor: {
		wiki: 'https://wiki.bloodontheclocktower.com/Professor',
		labels: {
			Alive: {
				seat: 'other',
				types: ['townsfolk'],
				life: 'dead',
				note: 'A dead Townsfolk the Professor brings back to life.'
			},
			'No Ability': { seat: 'self', note: 'On the Professor after they use their ability.' }
		}
	},
	princess: {
		wiki: 'https://wiki.bloodontheclocktower.com/Princess',
		labels: {
			"Doesn't Kill": {
				seat: 'other',
				types: ['demon'],
				note: 'On the Demon after the Princess nominates and executes on day one.'
			}
		}
	},
	amnesiac: {
		wiki: 'https://wiki.bloodontheclocktower.com/Amnesiac',
		labels: {
			'?': {
				seat: 'any',
				note: "A general-purpose marker for whatever the Amnesiac's hidden ability tracks.",
				ambiguous:
					'The wiki says the token can be used if needed but gives no placement, since it depends on the ability chosen.'
			}
		}
	},
	fool: {
		wiki: 'https://wiki.bloodontheclocktower.com/Fool',
		labels: {
			'No Ability': { seat: 'self', note: 'On the Fool once they have survived their first death.' }
		}
	},
	butler: {
		wiki: 'https://wiki.bloodontheclocktower.com/Butler',
		labels: {
			Master: {
				seat: 'other',
				note: 'The player the Butler chose as master; dead players are allowed.'
			}
		}
	},
	drunk: {
		wiki: 'https://wiki.bloodontheclocktower.com/Drunk',
		labels: {
			'Is The Drunk': {
				seat: 'self',
				note: 'Beside the Townsfolk token of the player who is really the Drunk.'
			}
		}
	},
	plaguedoctor: {
		wiki: 'https://wiki.bloodontheclocktower.com/Plague_Doctor',
		labels: {
			'Storyteller Ability': {
				seat: 'other',
				types: ['minion'],
				note: 'On an in-play Minion whose ability the Storyteller gains, or on an out-of-play Minion token at the Grimoire side.',
				ambiguous:
					'The wiki allows either an in-play Minion or a Minion token placed off the seats, so it may be global instead.'
			}
		}
	},
	damsel: {
		wiki: 'https://wiki.bloodontheclocktower.com/Damsel',
		labels: {
			'Guess Used': { seat: 'self', note: "On the Damsel after a Minion's guess has been spent." }
		}
	},
	poisoner: {
		wiki: 'https://wiki.bloodontheclocktower.com/Poisoner',
		labels: {
			Poisoned: {
				seat: 'any',
				note: 'Any player the Poisoner chooses.',
				ambiguous:
					'The wiki does not say whether the Poisoner can choose themselves or a dead player.'
			}
		}
	},
	cerenovus: {
		wiki: 'https://wiki.bloodontheclocktower.com/Cerenovus',
		labels: {
			Mad: { seat: 'any', note: 'Any player the Cerenovus makes mad about a good character.' }
		}
	},
	widow: {
		wiki: 'https://wiki.bloodontheclocktower.com/Widow',
		labels: {
			Know: {
				seat: 'any',
				alignment: 'good',
				note: 'The one good player who learns a Widow is in play.'
			},
			Poisoned: { seat: 'any', note: 'Any player the Widow poisons, possibly the Widow itself.' }
		}
	},
	eviltwin: {
		wiki: 'https://wiki.bloodontheclocktower.com/Evil_Twin',
		labels: {
			Twin: {
				seat: 'other',
				alignment: 'opposite',
				note: 'The good twin, not the Evil Twin; the wiki advises against a Traveller.'
			}
		}
	},
	yaggababble: {
		wiki: 'https://wiki.bloodontheclocktower.com/Yaggababble',
		labels: {
			Dead: {
				seat: 'any',
				note: "A player who dies from the phrase; also used as a tally at the Grimoire's side.",
				ambiguous:
					'The wiki also places this token off-seat as a count of times the phrase was said, and does not say whether targets must be alive.'
			}
		}
	},
	imp: {
		wiki: 'https://wiki.bloodontheclocktower.com/Imp',
		labels: {
			Dead: {
				seat: 'any',
				note: 'Any player the Imp attacks, including itself or a player already dead.'
			}
		}
	},
	po: {
		wiki: 'https://wiki.bloodontheclocktower.com/Po',
		labels: {
			'3 Attacks': {
				seat: 'self',
				note: 'On the Po after it chooses no one, until it takes three kills.'
			},
			Dead: { seat: 'any', note: 'Any player the Po attacks.' }
		}
	},
	legion: {
		wiki: 'https://wiki.bloodontheclocktower.com/Legion',
		labels: {
			'About To Die': {
				seat: 'any',
				note: 'The player secretly executed when a zero-vote test is forced.'
			},
			Dead: {
				seat: 'any',
				note: 'Any player who dies to Legion at night.',
				ambiguous:
					'The How to Run section never mentions the Dead token, so its placement is inferred from the ability.'
			}
		}
	},
	alhadikhia: {
		wiki: 'https://wiki.bloodontheclocktower.com/Al-Hadikhia',
		labels: {
			'1': { seat: 'any', note: 'The first player the Al-Hadikhia chooses tonight.' },
			'2': { seat: 'any', note: 'The second player chosen tonight.' },
			'3': { seat: 'any', note: 'The third player chosen tonight.' }
		}
	},
	bureaucrat: {
		wiki: 'https://wiki.bloodontheclocktower.com/Bureaucrat',
		labels: {
			'3 Votes': {
				seat: 'other',
				note: 'The player whose vote counts triple tomorrow; dead players are allowed.'
			}
		}
	},
	bonecollector: {
		wiki: 'https://wiki.bloodontheclocktower.com/Bone_Collector',
		labels: {
			'Has Ability': {
				seat: 'any',
				life: 'dead',
				note: 'The dead player who regains their ability until dusk.'
			},
			'No Ability': {
				seat: 'self',
				note: 'On the Bone Collector once they have used their ability.'
			}
		}
	},
	bishop: {
		wiki: 'https://wiki.bloodontheclocktower.com/Bishop',
		labels: {
			'Nominate Evil': {
				seat: 'self',
				alignment: 'good',
				note: 'On a good Bishop each dawn until an evil player is nominated.'
			},
			'Nominate Good': {
				seat: 'self',
				alignment: 'evil',
				note: 'On an evil Bishop each dawn until a good player is nominated.'
			}
		}
	},
	fibbin: {
		wiki: 'https://wiki.bloodontheclocktower.com/Fibbin',
		labels: {
			'No Ability': {
				global: true,
				note: 'Beside the Fibbin token in the Grimoire once it has been used.'
			}
		}
	},
	toymaker: {
		wiki: 'https://wiki.bloodontheclocktower.com/Toymaker',
		labels: {
			'Final Night: No Attack': {
				seat: 'any',
				types: ['demon'],
				note: 'On the Demon until it skips an attack.'
			}
		}
	},
	ventriloquist: {
		wiki: 'https://wiki.bloodontheclocktower.com/Ventriloquist',
		labels: {
			Mad: {
				seat: 'any',
				life: 'alive',
				note: 'A nominee about to die who is claiming a character different from an earlier claim.'
			}
		}
	},
	knight: {
		wiki: 'https://wiki.bloodontheclocktower.com/Knight',
		labels: {
			Know: {
				seat: 'any',
				types: ['townsfolk', 'outsider', 'minion', 'traveller'],
				note: 'Two non-Demon players shown to the Knight at setup; with the Vortox in play one of them may be the Demon.'
			}
		}
	},
	grandmother: {
		wiki: 'https://wiki.bloodontheclocktower.com/Grandmother',
		labels: {
			Grandchild: {
				seat: 'other',
				types: ['townsfolk', 'outsider'],
				alignment: 'good',
				note: 'A good Townsfolk or Outsider other than the Grandmother, chosen at setup.'
			},
			Dead: { seat: 'self', note: 'On the Grandmother when the Demon kills her Grandchild.' }
		}
	},
	sailor: {
		wiki: 'https://wiki.bloodontheclocktower.com/Sailor',
		labels: {
			Drunk: {
				seat: 'any',
				life: 'alive',
				note: "Either the Sailor or the alive player they chose, at the Storyteller's call."
			}
		}
	},
	snakecharmer: {
		wiki: 'https://wiki.bloodontheclocktower.com/Snake_Charmer',
		labels: {
			Poisoned: {
				seat: 'any',
				characters: ['snakecharmer'],
				note: 'On the player who was the Demon and has just become the new Snake Charmer after the swap.'
			}
		}
	},
	towncrier: {
		wiki: 'https://wiki.bloodontheclocktower.com/Town_Crier',
		labels: {
			'Minions Not Nominated': {
				seat: 'self',
				note: 'On the Town Crier from dawn until a Minion nominates.'
			},
			'Minion Nominated': {
				seat: 'self',
				note: 'On the Town Crier, replacing the other reminder, once a Minion nominates that day.'
			}
		}
	},
	gambler: {
		wiki: 'https://wiki.bloodontheclocktower.com/Gambler',
		labels: {
			Dead: { seat: 'self', note: 'On the Gambler after a wrong guess.' }
		}
	},
	gossip: {
		wiki: 'https://wiki.bloodontheclocktower.com/Gossip',
		labels: {
			Dead: {
				seat: 'any',
				note: "On any player the Storyteller picks to die that night after a true statement; parked by the Grimoire's left side during the day."
			}
		}
	},
	seamstress: {
		wiki: 'https://wiki.bloodontheclocktower.com/Seamstress',
		labels: {
			'No Ability': { seat: 'self', note: 'On the Seamstress once they have used their ability.' }
		}
	},
	artist: {
		wiki: 'https://wiki.bloodontheclocktower.com/Artist',
		labels: {
			'No Ability': { seat: 'self', note: 'On the Artist once their question is answered.' }
		}
	},
	juggler: {
		wiki: 'https://wiki.bloodontheclocktower.com/Juggler',
		labels: {
			Correct: { seat: 'self', note: 'On the Juggler, one per correct guess.' }
		}
	},
	minstrel: {
		wiki: 'https://wiki.bloodontheclocktower.com/Minstrel',
		labels: {
			'Everyone Is Drunk': {
				global: true,
				note: "Beside the Grimoire, not on a player, from the Minion's execution until dusk the next day."
			}
		}
	},
	virgin: {
		wiki: 'https://wiki.bloodontheclocktower.com/Virgin',
		labels: {
			'No Ability': { seat: 'self', note: 'On the Virgin the first time they are nominated.' }
		}
	},
	goon: {
		wiki: 'https://wiki.bloodontheclocktower.com/Goon',
		labels: {
			Drunk: {
				seat: 'other',
				note: 'On the first player that night to choose the Goon with their own ability.'
			}
		}
	},
	tinker: {
		wiki: 'https://wiki.bloodontheclocktower.com/Tinker',
		labels: {
			Dead: { seat: 'self', note: 'On the Tinker when they die at night.' }
		}
	},
	moonchild: {
		wiki: 'https://wiki.bloodontheclocktower.com/Moonchild',
		labels: {
			Dead: {
				seat: 'other',
				alignment: 'good',
				note: 'On the alive player the Moonchild chose, only if that player is good.'
			}
		}
	},
	puzzlemaster: {
		wiki: 'https://wiki.bloodontheclocktower.com/Puzzlemaster',
		labels: {
			Drunk: { seat: 'any', note: 'On the one player made drunk at setup, usually a Townsfolk.' },
			'Guess Used': { seat: 'self', note: 'On the Puzzlemaster once they have made their guess.' }
		}
	},
	devilsadvocate: {
		wiki: "https://wiki.bloodontheclocktower.com/Devil's_Advocate",
		labels: {
			'Survives Execution': {
				seat: 'any',
				life: 'alive',
				note: "On the player chosen tonight, which may be the Devil's Advocate but not last night's choice.",
				ambiguous: 'The ability and summary say a living player, but How to Run says any player.'
			}
		}
	},
	fearmonger: {
		wiki: 'https://wiki.bloodontheclocktower.com/Fearmonger',
		labels: {
			Fear: { seat: 'any', note: 'On the one player the Fearmonger currently has chosen.' }
		}
	},
	xaan: {
		wiki: 'https://wiki.bloodontheclocktower.com/Xaan',
		labels: {
			'Night 1': { global: true, note: 'Added to the Grimoire on night 1, not on a player.' },
			'Night 2': { global: true, note: 'Added to the Grimoire on night 2, not on a player.' },
			'Night 3': { global: true, note: 'Added to the Grimoire on night 3, not on a player.' },
			X: {
				global: true,
				note: 'Added to the Grimoire on night X, while all Townsfolk are poisoned, until the next dusk.'
			}
		}
	},
	goblin: {
		wiki: 'https://wiki.bloodontheclocktower.com/Goblin',
		labels: {
			Claimed: {
				seat: 'self',
				note: 'On the Goblin after they publicly claim Goblin when nominated.'
			}
		}
	},
	pukka: {
		wiki: 'https://wiki.bloodontheclocktower.com/Pukka',
		labels: {
			Poisoned: { seat: 'any', note: 'On the player the Pukka chose tonight.' },
			Dead: {
				seat: 'any',
				withLabel: 'Poisoned',
				note: "On last night's poisoned player when they die."
			}
		}
	},
	shabaloth: {
		wiki: 'https://wiki.bloodontheclocktower.com/Shabaloth',
		labels: {
			Dead: {
				seat: 'any',
				note: 'On each of the two players the Shabaloth chose, alive or already dead.'
			},
			Alive: {
				seat: 'other',
				life: 'dead',
				withLabel: 'Dead',
				note: 'Replaces Dead on a player the Shabaloth chose last night who is regurgitated.'
			}
		}
	},
	zombuul: {
		wiki: 'https://wiki.bloodontheclocktower.com/Zombuul',
		labels: {
			Dead: { seat: 'any', note: 'On the player the Zombuul chose tonight.' },
			'Died Today': {
				seat: 'any',
				note: 'On any player who died during the day, the Zombuul included.'
			}
		}
	},
	fanggu: {
		wiki: 'https://wiki.bloodontheclocktower.com/Fang_Gu',
		labels: {
			Dead: {
				seat: 'any',
				note: 'On the player who dies: the chosen target, or the Fang Gu itself when it jumps into an Outsider.'
			},
			Once: {
				global: true,
				note: 'In the centre of the Grimoire after the first Outsider jump; stays all game.'
			}
		}
	},
	riot: {
		wiki: 'https://wiki.bloodontheclocktower.com/Riot',
		labels: {
			'Day 1': { global: true, note: 'Added to the Grimoire on day 1, not on a player.' },
			'Day 2': { global: true, note: 'Added to the Grimoire on day 2, not on a player.' },
			'Day 3': { global: true, note: 'Added to the Grimoire on day 3, not on a player.' }
		}
	},
	barista: {
		wiki: 'https://wiki.bloodontheclocktower.com/Barista',
		labels: {
			'Sober & Healthy': {
				seat: 'any',
				notWithLabel: 'Acts Twice',
				note: 'On the one player the Barista affects tonight.'
			},
			'Acts Twice': {
				seat: 'any',
				notWithLabel: 'Sober & Healthy',
				note: 'On the one player whose ability works twice tonight.'
			},
			'?': {
				seat: 'any',
				withLabel: 'Acts Twice',
				note: "On the player acting twice, standing in for their character's own reminders if needed."
			}
		}
	},
	judge: {
		wiki: 'https://wiki.bloodontheclocktower.com/Judge',
		labels: {
			'No Ability': { seat: 'self', note: 'On the Judge once they have used their ability.' }
		}
	},
	angel: {
		wiki: 'https://wiki.bloodontheclocktower.com/Angel',
		labels: {
			Protected: { seat: 'any', note: 'On each player the Angel protects, with their consent.' },
			'Something Bad': {
				seat: 'any',
				note: "On the player most responsible for a protected player's death."
			}
		}
	},
	hellslibrarian: {
		wiki: "https://wiki.bloodontheclocktower.com/Hell's_Librarian",
		labels: {
			'Something Bad': {
				seat: 'any',
				note: 'On a player who talked during a silence the Storyteller asked for.'
			}
		}
	},
	bootlegger: {
		wiki: 'https://wiki.bloodontheclocktower.com/Bootlegger',
		labels: {
			'?': {
				seat: 'any',
				note: 'Free-use marker for whatever homebrew rule needs tracking.',
				ambiguous: "The wiki never says where the Bootlegger's reminder goes."
			}
		}
	},
	zenomancer: {
		wiki: 'https://wiki.bloodontheclocktower.com/Zenomancer',
		labels: {
			Goal: {
				seat: 'any',
				note: 'On each player given a goal, alive or dead, Travellers included.'
			}
		}
	},
	noble: {
		wiki: 'https://wiki.bloodontheclocktower.com/Noble',
		labels: {
			Know: {
				seat: 'any',
				note: 'One of the three players shown to the Noble; two marked players are good and one is evil.'
			}
		}
	},
	librarian: {
		wiki: 'https://wiki.bloodontheclocktower.com/Librarian',
		labels: {
			Outsider: {
				seat: 'other',
				types: ['outsider'],
				note: 'The player whose Outsider character the Librarian is shown.'
			},
			Wrong: {
				seat: 'other',
				notWithLabel: 'Outsider',
				note: 'The second player shown, who is not that Outsider.'
			}
		}
	},
	balloonist: {
		wiki: 'https://wiki.bloodontheclocktower.com/Balloonist',
		labels: {
			Know: {
				seat: 'any',
				note: "The player shown tonight; after the first night their character type must differ from the previous night's pick."
			}
		}
	},
	mathematician: {
		wiki: 'https://wiki.bloodontheclocktower.com/Mathematician',
		labels: {
			Abnormal: {
				seat: 'any',
				note: "Any player whose ability misfired because of another character's ability since dawn."
			}
		}
	},
	undertaker: {
		wiki: 'https://wiki.bloodontheclocktower.com/Undertaker',
		labels: {
			'Died Today': {
				seat: 'other',
				life: 'dead',
				note: 'The player who was executed and died today.'
			}
		}
	},
	acrobat: {
		wiki: 'https://wiki.bloodontheclocktower.com/Acrobat',
		labels: {
			Chosen: { seat: 'any', note: 'The player the Acrobat picks tonight.' },
			Dead: {
				seat: 'self',
				note: 'The Acrobat, when their pick is or becomes drunk or poisoned tonight.'
			}
		}
	},
	engineer: {
		wiki: 'https://wiki.bloodontheclocktower.com/Engineer',
		labels: {
			'No Ability': { seat: 'self', note: 'The Engineer once they have used their ability.' }
		}
	},
	philosopher: {
		wiki: 'https://wiki.bloodontheclocktower.com/Philosopher',
		labels: {
			Drunk: {
				seat: 'other',
				types: ['townsfolk', 'outsider'],
				alignment: 'good',
				note: 'The in-play player whose good character the Philosopher took; removed if the Philosopher dies.'
			},
			'Is The Philosopher': {
				seat: 'self',
				note: "The Philosopher's own seat after their token is swapped for the chosen character."
			}
		}
	},
	slayer: {
		wiki: 'https://wiki.bloodontheclocktower.com/Slayer',
		labels: {
			'No Ability': { seat: 'self', note: 'The Slayer once they have used their shot.' }
		}
	},
	alchemist: {
		wiki: 'https://wiki.bloodontheclocktower.com/Alchemist',
		labels: {
			'Is The Alchemist': {
				seat: 'self',
				note: "The Alchemist's own seat, now showing the upside-down Minion token they copy."
			}
		}
	},
	banshee: {
		wiki: 'https://wiki.bloodontheclocktower.com/Banshee',
		labels: {
			'Has Ability': {
				seat: 'self',
				life: 'dead',
				note: 'The Banshee after the Demon has killed them while they had their ability.'
			}
		}
	},
	poppygrower: {
		wiki: 'https://wiki.bloodontheclocktower.com/Poppy_Grower',
		labels: {
			'Evil Wakes': { seat: 'self', life: 'dead', note: 'The Poppy Grower once they have died.' }
		}
	},
	ogre: {
		wiki: 'https://wiki.bloodontheclocktower.com/Ogre',
		labels: {
			Friend: {
				seat: 'other',
				note: 'The player the Ogre picked on their first night (optional token).'
			}
		}
	},
	golem: {
		wiki: 'https://wiki.bloodontheclocktower.com/Golem',
		labels: {
			'May Not Nominate': { seat: 'self', note: 'The Golem after they have nominated.' }
		}
	},
	barber: {
		wiki: 'https://wiki.bloodontheclocktower.com/Barber',
		labels: {
			'Haircuts Tonight': { seat: 'self', life: 'dead', note: 'The Barber once they have died.' }
		}
	},
	mezepheles: {
		wiki: 'https://wiki.bloodontheclocktower.com/Mezepheles',
		labels: {
			'No Ability': { seat: 'self', note: 'The Mezepheles once someone has turned evil.' },
			'Turns Evil': {
				seat: 'other',
				alignment: 'good',
				note: 'The first good player to say the secret word.'
			}
		}
	},
	harpy: {
		wiki: 'https://wiki.bloodontheclocktower.com/Harpy',
		labels: {
			'2nd': { seat: 'any', note: 'The second player the Harpy picks; may be dead or the Harpy.' },
			Mad: {
				seat: 'any',
				note: 'The first player the Harpy picks, who must be mad about the 2nd being evil.',
				ambiguous:
					'The wiki does not say whether the same player can be picked as both first and second.'
			}
		}
	},
	assassin: {
		wiki: 'https://wiki.bloodontheclocktower.com/Assassin',
		labels: {
			Dead: { seat: 'any', note: 'The player the Assassin picks, possibly the Assassin itself.' },
			'No Ability': { seat: 'self', note: 'The Assassin once they have used their ability.' }
		}
	},
	marionette: {
		wiki: 'https://wiki.bloodontheclocktower.com/Marionette',
		labels: {
			'Is The Marionette': {
				seat: 'any',
				alignment: 'evil',
				neighbour: { of: 'self', ofType: 'demon' },
				note: 'A player sitting next to the Demon who was dealt a good character token and thinks they are good.'
			}
		}
	},
	scarletwoman: {
		wiki: 'https://wiki.bloodontheclocktower.com/Scarlet_Woman',
		labels: {
			'Is The Demon': { seat: 'self', note: 'The Scarlet Woman after she becomes the Demon.' }
		}
	},
	lilmonsta: {
		wiki: "https://wiki.bloodontheclocktower.com/Lil'_Monsta",
		labels: {
			Dead: { seat: 'any', note: "Any player who dies at night to Lil' Monsta." },
			'Is The Demon': {
				seat: 'any',
				life: 'alive',
				note: 'The living player the Minions pick to babysit tonight; Minion or not.'
			}
		}
	},
	ojo: {
		wiki: 'https://wiki.bloodontheclocktower.com/Ojo',
		labels: {
			Dead: {
				seat: 'any',
				note: 'The player holding the named character, or a player the Storyteller picks when it is not in play.'
			}
		}
	},
	vigormortis: {
		wiki: 'https://wiki.bloodontheclocktower.com/Vigormortis',
		labels: {
			Dead: { seat: 'any', note: 'Any player the Vigormortis kills.' },
			'Has Ability': {
				seat: 'other',
				types: ['minion'],
				withLabel: 'Dead',
				note: 'A Minion the Vigormortis killed; it keeps its ability.'
			},
			Poisoned: {
				seat: 'other',
				types: ['townsfolk'],
				neighbour: { of: 'Has Ability', type: 'townsfolk' },
				note: 'The nearest Townsfolk either way round from that dead Minion; it may be dead, and the Storyteller picks if both sides tie.'
			}
		}
	},
	lordoftyphon: {
		wiki: 'https://wiki.bloodontheclocktower.com/Lord_of_Typhon',
		labels: {
			Dead: { seat: 'any', note: 'The player the Lord of Typhon picks to kill.' }
		}
	},
	leviathan: {
		wiki: 'https://wiki.bloodontheclocktower.com/Leviathan',
		labels: {
			'Day 1': {
				seat: 'self',
				note: 'The Leviathan during day 1; it carries only one day token at a time.'
			},
			'Day 2': {
				seat: 'self',
				note: 'The Leviathan during day 2; it carries only one day token at a time.'
			},
			'Day 3': {
				seat: 'self',
				note: 'The Leviathan during day 3; it carries only one day token at a time.'
			},
			'Day 4': {
				seat: 'self',
				note: 'The Leviathan during day 4; it carries only one day token at a time.'
			},
			'Day 5': {
				seat: 'self',
				note: 'The Leviathan during day 5; it carries only one day token at a time.'
			},
			'Good Player Executed': {
				seat: 'other',
				alignment: 'good',
				note: 'The first good player who is executed.'
			}
		}
	},
	harlot: {
		wiki: 'https://wiki.bloodontheclocktower.com/Harlot',
		labels: {
			Dead: {
				seat: 'any',
				note: 'The Harlot and the player they visited, if that player agreed and the Storyteller kills both.'
			}
		}
	},
	apprentice: {
		wiki: 'https://wiki.bloodontheclocktower.com/Apprentice',
		labels: {
			'Is The Apprentice': {
				seat: 'self',
				note: "The Apprentice's own seat once their token is swapped for the character whose ability they gained."
			}
		}
	},
	deusexfiasco: {
		wiki: 'https://wiki.bloodontheclocktower.com/Deus_ex_Fiasco',
		labels: {
			Whoopsie: {
				global: true,
				note: 'Added to the Grimoire each time the Storyteller admits a mistake; not on a player.'
			}
		}
	},
	revolutionary: {
		wiki: 'https://wiki.bloodontheclocktower.com/Revolutionary',
		labels: {
			Aligned: {
				seat: 'any',
				neighbour: { of: 'Aligned' },
				note: 'Each of the two neighbouring players who share an alignment.',
				ambiguous:
					'The How to Run section never mentions an ALIGNED token; it only places REGISTER FALSELY? between the pair.'
			},
			'Register Falsely?': {
				seat: 'any',
				withLabel: 'Aligned',
				note: 'One of the Revolutionary pair; removed once that player has registered falsely.'
			}
		}
	},
	godofug: {
		wiki: 'https://wiki.bloodontheclocktower.com/God_of_Ug',
		labels: {
			Hat: { seat: 'any', note: 'Whichever player currently wears the Ug hat.' }
		}
	},
	investigator: {
		wiki: 'https://wiki.bloodontheclocktower.com/Investigator',
		labels: {
			Minion: {
				seat: 'other',
				types: ['minion'],
				note: 'Goes on the Minion whose character the Investigator learns.'
			},
			Wrong: {
				seat: 'other',
				notWithLabel: 'Minion',
				note: 'Goes on the second shown player, who is not that Minion.'
			}
		}
	},
	pixie: {
		wiki: 'https://wiki.bloodontheclocktower.com/Pixie',
		labels: {
			Mad: {
				seat: 'other',
				types: ['townsfolk'],
				note: 'An in-play Townsfolk the Storyteller picks to show the Pixie.',
				ambiguous: "The wiki doesn't say whether the shown Townsfolk could be the Pixie itself."
			},
			'Has Ability': {
				seat: 'other',
				types: ['townsfolk'],
				life: 'dead',
				withLabel: 'Mad',
				note: 'Replaces Mad on that Townsfolk once they die, when the Pixie gains their ability.',
				ambiguous:
					"The wiki says to swap Mad for Has Ability but doesn't name whose token it sits by; the swap implies the dead Townsfolk."
			}
		}
	},
	preacher: {
		wiki: 'https://wiki.bloodontheclocktower.com/Preacher',
		labels: {
			'No Ability': {
				seat: 'other',
				types: ['minion'],
				note: 'A Minion the Preacher chooses, alive or dead.'
			}
		}
	},
	fortuneteller: {
		wiki: 'https://wiki.bloodontheclocktower.com/Fortune_Teller',
		labels: {
			'Red Herring': {
				seat: 'any',
				alignment: 'good',
				note: 'Any good player, possibly the Fortune Teller themself.'
			}
		}
	},
	innkeeper: {
		wiki: 'https://wiki.bloodontheclocktower.com/Innkeeper',
		labels: {
			Safe: { seat: 'any', note: 'Each of the two players the Innkeeper chooses.' },
			Drunk: {
				seat: 'any',
				withLabel: 'Safe',
				note: 'One of the two players the Innkeeper protected.'
			}
		}
	},
	exorcist: {
		wiki: 'https://wiki.bloodontheclocktower.com/Exorcist',
		labels: {
			Chosen: {
				seat: 'any',
				note: "The player the Exorcist chooses, not last night's pick.",
				ambiguous: "The wiki doesn't say whether the Exorcist may choose themself."
			}
		}
	},
	nightwatchman: {
		wiki: 'https://wiki.bloodontheclocktower.com/Nightwatchman',
		labels: {
			'No Ability': {
				seat: 'self',
				note: 'On the Nightwatchman once they have used their ability.'
			}
		}
	},
	huntsman: {
		wiki: 'https://wiki.bloodontheclocktower.com/Huntsman',
		labels: {
			'No Ability': { seat: 'self', note: 'On the Huntsman once they have used their ability.' }
		}
	},
	fisherman: {
		wiki: 'https://wiki.bloodontheclocktower.com/Fisherman',
		labels: {
			'No Ability': { seat: 'self', note: 'On the Fisherman once they have had their advice.' }
		}
	},
	cannibal: {
		wiki: 'https://wiki.bloodontheclocktower.com/Cannibal',
		labels: {
			Lunch: {
				seat: 'other',
				life: 'dead',
				note: 'The player who most recently died by execution.'
			},
			Poisoned: { seat: 'self', note: 'On the Cannibal when their lunch was evil.' }
		}
	},
	tealady: {
		wiki: 'https://wiki.bloodontheclocktower.com/Tea_Lady',
		labels: {
			'Cannot Die': {
				seat: 'other',
				alignment: 'good',
				life: 'alive',
				neighbour: { of: 'self', alive: true },
				note: "Each of the Tea Lady's two nearest living neighbours, only while both are good."
			}
		}
	},
	hermit: {
		wiki: 'https://wiki.bloodontheclocktower.com/Hermit',
		labels: {
			'1': {
				seat: 'any',
				note: 'Stands in for a reminder of an in-play Outsider whose ability the Hermit duplicates.',
				ambiguous:
					"The wiki says to use these instead of the duplicated Outsider's reminders but gives no placement rule."
			},
			'2': {
				seat: 'any',
				note: 'Stands in for a reminder of an in-play Outsider whose ability the Hermit duplicates.',
				ambiguous:
					"The wiki says to use these instead of the duplicated Outsider's reminders but gives no placement rule."
			},
			'3': {
				seat: 'any',
				note: 'Stands in for a reminder of an in-play Outsider whose ability the Hermit duplicates.',
				ambiguous:
					"The wiki says to use these instead of the duplicated Outsider's reminders but gives no placement rule."
			}
		}
	},
	lunatic: {
		wiki: 'https://wiki.bloodontheclocktower.com/Lunatic',
		labels: {
			Chosen: { seat: 'any', note: 'Each player the Lunatic chooses at night.' }
		}
	},
	sweetheart: {
		wiki: 'https://wiki.bloodontheclocktower.com/Sweetheart',
		labels: {
			Drunk: { seat: 'any', note: 'Any one player the Storyteller picks when the Sweetheart dies.' }
		}
	},
	hatter: {
		wiki: 'https://wiki.bloodontheclocktower.com/Hatter',
		labels: {
			'Tea Party Tonight': { seat: 'self', note: 'On the Hatter when they die.' }
		}
	},
	godfather: {
		wiki: 'https://wiki.bloodontheclocktower.com/Godfather',
		labels: {
			'Died Today': {
				seat: 'other',
				types: ['outsider'],
				life: 'dead',
				note: 'An Outsider who died during the day.'
			},
			Dead: { seat: 'any', note: 'The player the Godfather kills that night.' }
		}
	},
	witch: {
		wiki: 'https://wiki.bloodontheclocktower.com/Witch',
		labels: {
			Cursed: { seat: 'any', note: 'Any player the Witch chooses, even themself or a dead player.' }
		}
	},
	wizard: {
		wiki: 'https://wiki.bloodontheclocktower.com/Wizard',
		labels: {
			'?': {
				seat: 'any',
				note: 'Tracks whatever a granted wish needs.',
				ambiguous: "The wiki's How to Run doesn't mention the ? reminder or where it goes."
			}
		}
	},
	summoner: {
		wiki: 'https://wiki.bloodontheclocktower.com/Summoner',
		labels: {
			'Night 1': { seat: 'self', note: 'By the Summoner to count the nights.' },
			'Night 2': { seat: 'self', note: 'By the Summoner to count the nights.' },
			'Night 3': { seat: 'self', note: 'By the Summoner to count the nights.' }
		}
	},
	organgrinder: {
		wiki: 'https://wiki.bloodontheclocktower.com/Organ_Grinder',
		labels: {
			'About To Die': {
				seat: 'any',
				life: 'alive',
				note: 'The nominee who has enough votes to be executed.'
			},
			Drunk: { seat: 'self', note: 'On the Organ Grinder when they choose to be drunk.' }
		}
	},
	nodashii: {
		wiki: 'https://wiki.bloodontheclocktower.com/No_Dashii',
		labels: {
			Dead: { seat: 'any', note: 'The player the No Dashii kills that night.' },
			Poisoned: {
				seat: 'other',
				types: ['townsfolk'],
				neighbour: { of: 'self', type: 'townsfolk' },
				note: 'The nearest Townsfolk each way round from the No Dashii, alive or dead.'
			}
		}
	},
	kazali: {
		wiki: 'https://wiki.bloodontheclocktower.com/Kazali',
		labels: {
			Dead: { seat: 'any', note: 'The player the Kazali kills that night.' }
		}
	},
	vortox: {
		wiki: 'https://wiki.bloodontheclocktower.com/Vortox',
		labels: {
			Dead: { seat: 'any', note: 'The player the Vortox kills that night.' }
		}
	},
	lleech: {
		wiki: 'https://wiki.bloodontheclocktower.com/Lleech',
		labels: {
			Dead: { seat: 'any', note: 'The player the Lleech kills that night.' },
			Poisoned: {
				seat: 'any',
				note: 'The host the Lleech picks on the first night.',
				ambiguous: "The wiki says any player and doesn't say whether the Lleech may pick itself."
			}
		}
	},
	thief: {
		wiki: 'https://wiki.bloodontheclocktower.com/Thief',
		labels: {
			'Negative Vote': {
				seat: 'other',
				note: 'The player the Thief chooses, never themself; dead players allowed.'
			}
		}
	},
	cacklejack: {
		wiki: 'https://wiki.bloodontheclocktower.com/Cacklejack',
		labels: {
			'Not Me': {
				seat: 'any',
				note: 'The player the Cacklejack chooses that day.',
				ambiguous:
					"The wiki doesn't say whether the Cacklejack may choose themself or a dead player."
			}
		}
	},
	gnome: {
		wiki: 'https://wiki.bloodontheclocktower.com/Gnome',
		labels: {
			Amigo: {
				seat: 'other',
				alignment: 'same',
				note: "Another player who shares the Gnome's alignment."
			}
		}
	},
	duchess: {
		wiki: 'https://wiki.bloodontheclocktower.com/Duchess',
		labels: {
			Visitor: { seat: 'any', note: 'Two of the three players who visited the Duchess today.' },
			'False Info': {
				seat: 'any',
				notWithLabel: 'Visitor',
				note: 'The third visitor, who gets false info.'
			}
		}
	},
	spiritofivory: {
		wiki: 'https://wiki.bloodontheclocktower.com/Spirit_of_Ivory',
		labels: {
			'No More Evil': {
				global: true,
				note: 'Sits on the Spirit of Ivory once the extra evil player has been made.'
			}
		}
	},
	stormcatcher: {
		wiki: 'https://wiki.bloodontheclocktower.com/Storm_Catcher',
		labels: {
			Stormcaught: {
				seat: 'any',
				types: ['townsfolk', 'outsider'],
				note: 'The player with the named good character, if it is in play.',
				ambiguous: "The wiki calls this token SAFE; TPI's data names it Stormcaught."
			}
		}
	}
};
