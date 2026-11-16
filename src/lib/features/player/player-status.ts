import { parsePlayersPhase, type PlayersPhase } from '#lib/core/rules/game-phase.ts';

/**
 * What the status box over the player screen's tabs shows (Trevor, 2026-11-16: "unify into
 * one"): exactly one thing at a time, in one box of one size, chosen here by one ranking for
 * phones and the Storyteller's Player view alike.
 */
export type PlayerStatus =
	| { kind: 'joining' }
	| { kind: 'offline' }
	| { kind: 'choosing' }
	| { kind: 'over'; winner?: 'good' | 'evil' }
	| { kind: 'character' }
	| { kind: 'selectSeat' }
	| { kind: 'phase'; phase: PlayersPhase }
	| { kind: 'none' };

export interface PlayerStatusFacts {
	/**
	 * A phone's link to its room: `joining` before the room first answers, `offline` while it
	 * reconnects, at any point of the game. The Storyteller's view has no link of its own.
	 */
	link?: 'joining' | 'offline' | 'open';
	/** The Storyteller is choosing the next script. */
	choosing?: boolean;
	/** The game on the table is over, with who won where the Storyteller said. */
	over?: { winner?: 'good' | 'evil' };
	/** Players may see their characters now. */
	character?: boolean;
	/** This phone has a seat to pick, away from where seats are picked. */
	selectSeat?: boolean;
	/** Where the game is up to, as the room sends it (`PublicGameState.now`). */
	now?: unknown;
}

/**
 * The one status to show, highest first: the room link, the Storyteller choosing, the game's
 * end, Your character, Select seat, then where the game is up to. Game over and Your
 * character never show together (Trevor, 2026-11-15), and a phone with no seat has no
 * character, so ranking them settles every pair.
 */
export function playerStatus(facts: PlayerStatusFacts): PlayerStatus {
	if (facts.link === 'joining') return { kind: 'joining' };
	if (facts.link === 'offline') return { kind: 'offline' };
	if (facts.choosing) return { kind: 'choosing' };
	if (facts.over) return { kind: 'over', winner: facts.over.winner };
	if (facts.character) return { kind: 'character' };
	if (facts.selectSeat) return { kind: 'selectSeat' };
	const phase = parsePlayersPhase(facts.now);
	return phase ? { kind: 'phase', phase } : { kind: 'none' };
}
