/**
 * The Character Lab on the Characters page (plans M45, M47): one core character, picked on the
 * left, tested against each character it has a jinx with, on the right (Trevor, 2026-11-05:
 * "the whole lock system is weird ... Just allow setting what the core one is on the left
 * side, start empty"). This holds what the page, the lab panel and the phone's bar share.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Character, CharacterId, Jinx } from '#lib/core/data/index.ts';
import {
	labOpponents,
	stepCharacter,
	type LabData,
	type LabOpponent
} from '#lib/core/lab/lab-game.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { labData } from './lab-data.ts';
import { lab } from './lab-store.svelte.ts';
import { loadLabGame } from './load-lab-game.ts';

export class LabSession {
	/** The official data and this device's custom characters, once loaded. */
	data = $state<LabData>();
	loading = $state(false);
	/** Bumped on each load, so a frame opens the new game even at the same address. */
	loads = $state(0);

	readonly setup = $derived(lab.current);
	/** The core character, which Previous and Next character swap; none until one is picked. */
	readonly core: CharacterId | undefined = $derived(this.setup.core);
	readonly #kept = $derived(this.core ? [this.core] : []);
	/** Every character with a jinx with the core one, in jinx order. */
	readonly opponents: LabOpponent[] = $derived(
		this.data && this.core ? labOpponents(this.data, this.#kept, { kind: 'jinxes' }) : []
	);
	readonly at = $derived(Math.min(this.setup.index, Math.max(0, this.opponents.length - 1)));
	readonly current: LabOpponent | undefined = $derived(this.opponents[this.at]);

	/** The jinx between the core character and the one shown. */
	readonly pairJinxes: Jinx[] = $derived(this.current?.jinxes ?? []);

	readonly gamePath = $derived(
		this.setup.gameId ? resolve('/grimoire/[gameId]', { gameId: this.setup.gameId }) : undefined
	);

	byId = (id: CharacterId): Character | undefined => this.data?.byId.get(id);

	/** Makes `id` the core character, or clears it. */
	setCore(id: CharacterId | undefined): void {
		lab.update({ core: id, index: 0 });
	}

	/** Shows the opponent at `index` without loading its game. */
	show(index: number): void {
		lab.update({ index });
	}

	/**
	 * Saves a fresh game for the opponent at `index` (the one shown by default). `open` goes to
	 * it as well, for a screen with no room for the Storyteller frame.
	 */
	async load(index = this.at, open = false): Promise<void> {
		if (this.loading) return;
		this.loading = true;
		try {
			const data = this.data ?? labData(await loadOfficialData());
			const kept = this.core ? [this.core] : [];
			const list = this.core ? labOpponents(data, kept, { kind: 'jinxes' }) : [];
			const i = Math.min(Math.max(0, index), Math.max(0, list.length - 1));
			const game = await loadLabGame(
				data,
				{
					playerCount: this.setup.playerCount,
					locked: kept,
					opponent: list[i]?.id,
					// The opponent always plays (Trevor, 2026-11-04: "jinx partner is is a weird
					// setting").
					place: 'in-play',
					filler: this.setup.filler,
					setupTokens: this.setup.setupTokens
				},
				this.setup.gameId,
				this.setup.startDay
			);
			lab.update({ index: i, gameId: game.game.gameId });
			this.loads++;
			if (open) await goto(resolve('/grimoire/[gameId]', { gameId: game.game.gameId }));
		} catch (e) {
			reportError(e, { area: 'grimoire' });
		} finally {
			this.loading = false;
		}
	}

	/**
	 * Swaps the core character for the one before or after it in `roles.json` with a jinx, and
	 * loads that game (Trevor, 2026-11-03: "so that you don't have to go into the character
	 * selector each time").
	 */
	async stepCore(step: -1 | 1, open = false): Promise<void> {
		if (!this.data || !this.core) return;
		const next = stepCharacter(this.data, this.core, step, [], true);
		if (!next) return;
		this.setCore(next);
		await this.load(0, open);
	}
}
