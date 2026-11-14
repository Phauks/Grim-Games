import type { Words } from './field-spec.ts';
import type { JinxRuleKey } from './jinx-rules.ts';

/**
 * Each jinx effect's name and help line in plain words for the Character builder, with its own
 * settings' words by path (`wordAt`, M81). Our own words, never wiki prose.
 */
export const VERB_WORDS: {
	readonly [K in Exclude<JinxRuleKey, 'exclusive'>]: Words & {
		fields?: Readonly<Record<string, Words>>;
	};
} = {
	cannotCreate: {
		label: 'Can’t make the partner',
		fields: {
			via: {
				label: 'With',
				names: { givesAbility: 'Giving an ability', changesCharacter: 'Changing a character' }
			}
		}
	},
	cannotChoose: { label: 'Can’t choose the partner' },
	givenInstead: {
		label: 'Given instead',
		about: 'When it would give the partner’s ability to the Storyteller.',
		fields: {
			instead: {
				label: 'Instead',
				names: { 'a-minion': 'A Minion holds it', becomes: 'A player becomes it' }
			},
			type: { label: 'Or a character of type' },
			upTo: { label: 'Up to this many players' },
			where: { label: 'Only', names: { 'demon-good-neighbour': 'A good neighbour of the Demon' } }
		}
	},
	noTurnGood: { label: 'Can’t turn good', about: 'A player it gives the partner to stays evil.' },
	spareToken: {
		label: 'May use a spare token',
		about: 'May give or make the partner while it is in play.'
	},
	storytellerChooses: {
		label: 'Storyteller chooses',
		fields: {
			what: {
				label: 'What',
				names: {
					player: 'The player it picks',
					'another-player': 'Another player instead of the partner',
					'own-execution': 'Whether the nominated Storyteller dies'
				}
			},
			via: {
				label: 'For',
				names: { changesCharacter: 'Changing a character', carrierIsDemon: 'Who carries the Demon' }
			},
			creating: { label: 'Only when making', names: { partner: 'The partner' } }
		}
	},
	wakes: {
		label: 'Wakes',
		fields: { how: { label: 'How', names: { 'one-by-one': 'One by one' } } }
	},
	alsoBecomes: {
		label: 'Others also become',
		about: 'When it makes a player the partner.',
		fields: {
			type: { label: 'Of type' },
			players: {
				label: 'Who',
				names: { drafter: 'That same player', neighbours: 'Their neighbours' }
			}
		}
	},
	carriedBy: {
		label: 'Carried only by',
		about: 'Who may carry its Demon reminder.',
		fields: {
			type: { label: 'A player of type' },
			marked: { label: 'Or the player with the partner’s' }
		}
	},
	diesWhenExecuted: { label: 'Not saved from execution' },
	registersTo: {
		label: 'Registers to the partner as',
		fields: {
			alignments: { label: 'Alignments' },
			types: { label: 'Character types' },
			always: { label: 'Always, and only as these' }
		}
	},
	impairs: {
		label: 'Drunk, poisoned or no ability',
		fields: {
			kind: {
				label: 'Is',
				names: { poisoned: 'Poisoned', drunk: 'Drunk', 'no-ability': 'Without an ability' }
			},
			unlessImpaired: { label: 'Only while neither is otherwise' }
		}
	},
	noKill: {
		label: 'No kill tonight',
		fields: {
			on: {
				label: 'When',
				names: {
					token: 'The partner’s reminder is on its player',
					chosen: 'The partner chose its player'
				}
			},
			killer: { label: 'Or no kill by', names: { demon: 'Any Demon' } },
			token: { label: 'Partner’s reminder' }
		}
	},
	protects: {
		label: 'Protected',
		fields: {
			from: {
				label: 'Against',
				names: {
					demon: 'The Demon’s kill',
					any: 'Any death',
					execution: 'Only an execution',
					'not-execution': 'Any death but an execution',
					day: 'Any death by day',
					exile: 'Only an exile'
				}
			},
			night: { label: 'Only tonight' },
			by: { label: 'Only from', names: { partner: 'The partner' } }
		}
	},
	grimoire: {
		label: 'Grimoire shown',
		fields: {
			hides: { label: 'Hides' },
			'hides<All>': { names: { all: 'All of it' } },
			'hides<Some>': { names: { partner: 'The partner’s tokens' } }
		}
	},
	endsGame: {
		label: 'Ends the game',
		fields: {
			kind: {
				label: 'How',
				names: {
					condition: 'When these hold',
					'nominated-marked-executed': 'Its player nominates the marked player, executed',
					'marked-executed': 'The marked player is executed',
					'day-without-execution': 'Both alive at a day’s end with no execution',
					'ability-stopped': 'The partner stops its ability',
					'gained-end': 'Under the partner’s own game end',
					'night-instead': 'A night instead of the extra day',
					executed: 'A player is executed'
				}
			},
			winner: { label: 'Winning team' },
			end: {
				label: 'Partner’s game end',
				names: { 'dead-without-demon': 'No Demon and its players dead' }
			},
			chooser: { label: 'Chosen by', names: { self: 'This character', partner: 'The partner' } },
			token: { label: 'Partner’s reminder' },
			day: { label: 'Day' },
			alive: { label: 'Players alive' },
			player: {
				label: 'Executed player',
				names: { self: 'This character’s', partner: 'The partner’s' }
			},
			event: {
				label: 'When',
				names: {
					executed: 'A player is executed',
					'day-ends': 'A day ends',
					'ability-used': 'Its ability is used'
				}
			},
			subject: {
				label: 'About',
				names: {
					self: 'This character’s players',
					partner: 'The partner’s players',
					marked: 'The player with the partner’s reminder'
				}
			},
			nominatedBySelf: { label: 'Nominated by its player' },
			died: { label: 'The player died' },
			noExecution: { label: 'No execution that day' },
			bothAlive: { label: 'Both alive' },
			stops: { label: 'Its ability was stopped' }
		}
	},
	nightChoice: {
		label: 'Chooses each night',
		fields: {
			chooses: { label: 'Chooses', names: { good: 'A good player', any: 'Any player' } },
			partner: {
				label: 'A chosen partner',
				names: { acts: 'Uses its ability', dies: 'Dies and gains it' }
			}
		}
	},
	partnerSetup: {
		label: 'Partner’s setup change applies',
		about: 'When its player has the partner’s ability.'
	},
	partnerInPlay: {
		label: 'Partner is in play too',
		about: 'When its player has the partner’s ability.'
	},
	learns: {
		label: 'Learns',
		fields: {
			what: {
				label: 'What',
				names: {
					ability: 'It has the partner’s ability',
					answer: 'What the partner would learn',
					'no-ability': 'The partner took its ability',
					'partner-choice': 'Whom the partner chooses',
					alignment: 'Its alignment',
					character: 'A player’s true character',
					'good-players': 'Which players are good'
				}
			}
		}
	},
	trueInfo: { label: 'Partner’s information stays true' },
	notDeclared: { label: 'Not declared in play' },
	keepsProtection: { label: 'Keeps its protection' },
	noExecuteNow: {
		label: 'Can’t execute at once',
		fields: {
			player: {
				label: 'Who',
				names: { partner: 'The partner’s player', marked: 'The player with the partner’s reminder' }
			},
			token: { label: 'Partner’s reminder' }
		}
	},
	allEvilBecome: { label: 'All evil become the partner' },
	partnerKeepsAbility: { label: 'Partner keeps its ability' },
	storytellerHas: {
		label: 'Storyteller has its ability',
		fields: {
			once: {
				label: 'Once',
				names: { 'no-ability': 'Its player has none', changed: 'The partner changed its player' }
			}
		}
	},
	arbitraryDeaths: { label: 'Deaths may be arbitrary' },
	changesCharacter: {
		label: 'May make the partner',
		fields: { token: { label: 'While its player has' } }
	},
	guessesPartner: { label: 'May guess the partner' },
	notShown: {
		label: 'Not shown',
		fields: {
			what: {
				label: 'What',
				names: {
					'given-ability': 'The ability given',
					bluffs: 'The bluffs',
					'partner-seat': 'Which neighbour is the partner'
				}
			}
		}
	},
	notSecondDemon: { label: 'Never a second Demon' },
	keepsAbility: {
		label: 'Keeps the ability',
		fields: { afterDeath: { label: 'Even after that player dies' } }
	},
	survives: {
		label: 'Survives',
		fields: { on: { label: 'When', names: { 'carrier-executed': 'The carrier is executed' } } }
	},
	killsMarked: {
		label: 'Also kills the player with',
		fields: { token: { label: 'Partner’s reminder' } }
	},
	thinksPartnerSetup: { label: 'Partner’s setup change while thought to be it' },
	voter: {
		label: 'Votes',
		fields: { countsOnlyWith: { label: 'Counts only with its partner’s vote' } }
	},
	abnormalCounts: {
		label: 'Also counted as abnormal',
		fields: {
			counts: {
				label: 'When',
				names: {
					'self-caused': 'Caused by the partner itself',
					'unlike-demon': 'Not chosen like a Demon'
				}
			}
		}
	},
	patch: {
		label: 'Works differently',
		about: 'Rules in place of its own while the jinx holds.',
		fields: { parts: { label: 'Rules text' } }
	}
};
