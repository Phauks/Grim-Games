<script lang="ts" module>
	import type { SeatId } from '#lib/core/model/index.ts';
	import type { NightStep } from '#lib/core/rules/night/night-order.ts';
	import { ruleSources } from '#lib/core/rules/rule-sources.ts';
	import { delaysInfo, heldInfo, infoDelayOf } from '#lib/core/rules/night/info/held-info.ts';
	import { playedRules } from '#lib/features/modes/game-mode.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';

	/** Whether a rule in play (`infoDelay`) holds this step's information until tomorrow night. */
	function delayed(grimoire: Grimoire, step: NightStep | undefined): boolean {
		const game = grimoire.game;
		const characters = grimoire.open.characters;
		const delay = infoDelayOf(ruleSources(game, characters, playedRules(game.gameId)));
		return !!step?.character && delaysInfo(game, step.character.id, characters, delay);
	}

	/**
	 * A number shown on a delayed step is kept for tomorrow, in the same words as a Valid
	 * Information row ("Shown 0"), so showing it from either records it once. Not on the step
	 * that gives last night's, and not twice in a row.
	 */
	export function recordHeldNumber(
		grimoire: Grimoire,
		step: NightStep | undefined,
		holders: readonly SeatId[],
		n: number
	) {
		const seatId = holders.length === 1 ? holders[0] : undefined;
		const characterId = step?.character?.id;
		if (!seatId || !characterId || step?.heldInfo || grimoire.open.viewOnly) return;
		if (!delayed(grimoire, step)) return;
		const text = `Shown ${n}`;
		const last = grimoire.game.today.entries.findLast(
			(e) => e.kind === 'info' && e.seatId === seatId && e.characterId === characterId
		);
		if (last?.kind === 'info' && last.text === text) return;
		grimoire.run({ type: 'RecordNightInfo', seatId, characterId, text });
	}
</script>

<script lang="ts">
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import ShowToPlayerButton from '#lib/features/show/ShowToPlayerButton.svelte';

	/**
	 * One Day More's Signal Failure (https://beardytas.com/garden-of-djinn/one-day-more/): on a
	 * step whose information is delayed (`infoDelay`), what the player gets tonight is what was
	 * worked out last night, and tonight's is kept for tomorrow. Drawn whenever the rule delays
	 * the step, with "None" when nothing is held, so the step keeps its shape; nothing otherwise.
	 */
	interface Props {
		grimoire: Grimoire;
		step: NightStep | undefined;
		seats: readonly SeatId[];
		onShowAnswer: (answer: string) => void;
	}

	let { grimoire, step, seats, onShowAnswer }: Props = $props();

	const game = $derived(grimoire.game);
	const shown = $derived(delayed(grimoire, step));
	const held = $derived(
		shown && step?.character
			? seats.map((seatId) => ({
					seatId,
					items: heldInfo(game, seatId, step.character!.id, grimoire.open.characters)
				}))
			: []
	);
</script>

{#if shown}<section class="held" data-testid="held-info" aria-label="Held from last night">
		<h4>Held from last night</h4>
		{#each held as { seatId, items } (seatId)}
			{#if seats.length > 1}<p class="who"><PlayerBadge name={seatName(game, seatId)} /></p>{/if}
			{#if items.length === 0}
				<p class="muted">None</p>
			{:else}
				<ul>
					{#each items as item (item.entryId)}
						<li>
							<span class="text">{item.text}</span>
							{#if item.impaired}<span class="tag" data-testid="held-impaired"
									>Drunk or poisoned now: may be false</span
								>{/if}
							<ShowToPlayerButton onclick={() => onShowAnswer(item.shows)} />
						</li>
					{/each}
				</ul>
			{/if}
		{/each}
		<p class="note" data-testid="held-note">Tonight’s information is kept for tomorrow night.</p>
	</section>{/if}

<style>
	.held {
		display: grid;
		gap: var(--space-1);
		margin-block: var(--space-2);
	}
	h4 {
		margin: 0;
		font-size: 1rem;
	}
	ul {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
		align-items: center;
	}
	.text {
		flex: 1 1 auto;
	}
	.muted,
	.who,
	.note {
		margin: 0;
	}
	.muted,
	.note {
		color: var(--on-surface-muted);
	}
	.tag {
		font-size: 0.875rem;
		color: var(--on-surface-muted);
	}
</style>
