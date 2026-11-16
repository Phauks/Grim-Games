import type { PublicLook } from '#lib/core/sync/public-projection.ts';
import { boardLooks } from '#lib/features/board/board-looks.svelte.ts';
import { drawnLook } from '#lib/features/board/shared-look.ts';
import { roomHost } from '#lib/features/room/host.svelte.ts';
import type { Grimoire } from './grimoire.svelte.ts';

/**
 * The look a board shows: its own, which it shares with the room, or, watching, the look
 * its Storyteller shared (Trevor, 2026-10-26).
 */
export class ShownLook {
	#own = $state<PublicLook>();
	#picture = $state.raw<Blob>();
	readonly #board: () => { grimoire: Grimoire; watching: boolean };

	constructor(board: () => { grimoire: Grimoire; watching: boolean }) {
		this.#board = board;
	}

	get look(): PublicLook | undefined {
		const { grimoire, watching } = this.#board();
		return watching ? grimoire.look : this.#own;
	}

	/** Its own background's picture; a watched board's comes through its room. */
	get picture(): Blob | undefined {
		return this.#board().watching ? undefined : this.#picture;
	}

	/** Both, as the players' screen takes them. */
	get shown(): { look?: PublicLook; picture?: Blob } {
		return { look: this.look, picture: this.picture };
	}

	/** How strongly the script's logo shows, or undefined when it doesn't. */
	get logoOpacity(): number | undefined {
		const { grimoire, watching } = this.#board();
		if (watching) return drawnLook(grimoire.look).logo;
		return boardLooks.current.logo ? boardLooks.current.logoOpacity : undefined;
	}

	share = (shown: PublicLook, picture?: Blob): void => {
		this.#own = shown;
		this.#picture = picture;
		roomHost().showLook(this.#board().grimoire.open.game.gameId, shown, picture);
	};
}
