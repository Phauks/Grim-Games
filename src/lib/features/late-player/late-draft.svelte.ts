import type { LatePlayer } from './late-player.ts';

/**
 * The late players being added, kept while the Storyteller goes from the bag draw's modal to
 * the grimoire to choose a seat and back (Trevor, 2026-10-30). Only this tab, until confirmed.
 */
class LateDraft {
	players = $state<LatePlayer[]>([]);
	/** The row whose seat is being chosen on the grimoire. */
	placing = $state<number | undefined>();
	#key = 0;

	/** A new draft with one late player, not placed yet. */
	start(): void {
		this.players = [];
		this.placing = undefined;
		this.add();
	}

	add(): void {
		this.players = [...this.players, { key: this.#key++, name: '' }];
	}
}

export const lateDraft = new LateDraft();
