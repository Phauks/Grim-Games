/**
 * The Character Lab on the Characters page (plan M45, Trevor 2026-11-04: "The only difference
 * between reference and lab is seeing everything at the same time"): the opponents are the
 * table's rows as shown, and this holds what the lab panel, the phone's bar and the table's
 * Lock column share: the opponent shown, its jinxes and loading a game.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Character, CharacterId, GameData, Jinx } from '#lib/core/data/index.ts';
import { labOpponents, stepCharacter, type LabOpponent } from '#lib/core/lab/lab-game.ts';
import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
import { reportError } from '#lib/features/errors/report.svelte.ts';
import { lab } from './lab-store.svelte.ts';
import { loadLabGame } from './load-lab-game.ts';

export class LabSession {
	/** The official data, once loaded. */
	data = $state<GameData>();
	/** The table's rows as shown (search, filters, sort), in order. */
	listed = $state<readonly CharacterId[]>([]);
	loading = $state(false);
	/** Bumped on each load, so a frame opens the new game even at the same address. */
	loads = $state(0);

	readonly setup = $derived(lab.current);
	readonly locked = $derived(this.setup.locked);
	/** The first locked character, which Previous and Next character swap. */
	readonly testing = $derived(this.setup.locked[0]);
	readonly opponents: LabOpponent[] = $derived(
		this.data ? labOpponents(this.data, this.locked, { kind: 'listed', ids: this.listed }) : []
	);
	readonly at = $derived(Math.min(this.setup.index, Math.max(0, this.opponents.length - 1)));
	readonly current: LabOpponent | undefined = $derived(this.opponents[this.at]);

	/** Every character jinxed with a locked one: the table's "Jinxed with locked" filter. */
	readonly jinxed: readonly CharacterId[] = $derived(
		this.data ? labOpponents(this.data, this.locked, { kind: 'jinxes' }).map((o) => o.id) : []
	);
	/** The filter applies while a character is locked. */
	readonly jinxFilterOn = $derived(this.setup.jinxedOnly && this.locked.length > 0);

	/** The jinxes in the loaded game's pairing: the locked characters' own, and the opponent's. */
	readonly pairJinxes: Jinx[] = $derived.by(() => {
		if (!this.data) return [];
		const ids = [...this.locked, ...(this.current ? [this.current.id] : [])];
		return this.data.jinxes.all.filter(
			({ characters: [a, b] }) => ids.includes(a) && ids.includes(b)
		);
	});

	readonly gamePath = $derived(
		this.setup.gameId ? resolve('/grimoire/[gameId]', { gameId: this.setup.gameId }) : undefined
	);

	byId = (id: CharacterId): Character | undefined => this.data?.byId.get(id);

	setLocked(id: CharacterId, on: boolean): void {
		const locked = this.locked.filter((l) => l !== id);
		lab.update({ locked: on ? [...locked, id] : locked, index: 0 });
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
			const data = this.data ?? (await loadOfficialData());
			const list = labOpponents(data, this.locked, { kind: 'listed', ids: this.listed });
			const i = Math.min(Math.max(0, index), Math.max(0, list.length - 1));
			const game = await loadLabGame(
				data,
				{
					playerCount: this.setup.playerCount,
					locked: this.locked,
					opponent: list[i]?.id,
					place: this.setup.place,
					filler: this.setup.filler
				},
				this.setup.gameId
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
	 * Swaps the character under test for the one before or after it in `roles.json` and loads
	 * that game (Trevor, 2026-11-03: "so that you don't have to go into the character selector
	 * each time"). With the jinx filter on, only characters with a jinx.
	 */
	async stepTesting(step: -1 | 1, open = false): Promise<void> {
		if (!this.data || !this.testing) return;
		const next = stepCharacter(
			this.data,
			this.testing,
			step,
			this.locked.slice(1),
			this.setup.jinxedOnly
		);
		if (!next) return;
		lab.update({ locked: [next, ...this.locked.slice(1)], index: 0 });
		// The table's rows follow the new lock before the game picks its opponent.
		await Promise.resolve();
		await this.load(0, open);
	}
}
