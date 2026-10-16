<script lang="ts">
	import type { Alignment } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { seatName } from './night-steps.ts';

	/**
	 * A Traveller's alignment by draw (Trevor, 2026-10-16): the Storyteller chooses how many
	 * face-down tokens to offer and how many are evil (none of four evil still lets the
	 * player feel they chose), hands the device over, and the Traveller taps one. The token
	 * turns over and sets the alignment, which History can undo. The counts are never shown
	 * while the player picks.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
		seatId: SeatId | undefined;
	}

	let { open = $bindable(), grimoire, seatId }: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const seat = $derived(seatId ? game.seats[seatId] : undefined);

	const MAX = 8;
	let count = $state(4);
	let evil = $state(1);
	let phase = $state<'setup' | 'pick' | 'shown'>('setup');
	let tokens = $state<Alignment[]>([]);
	let picked = $state<number | undefined>();
	$effect(() => {
		if (!open) {
			phase = 'setup';
			picked = undefined;
		}
	});
	$effect(() => {
		if (evil > count) evil = count;
	});

	/** A fair shuffle with the browser's random numbers. */
	function shuffle<T>(list: T[]): T[] {
		const out = [...list];
		const random = new Uint32Array(out.length);
		crypto.getRandomValues(random);
		for (let i = out.length - 1; i > 0; i--) {
			const j = random[i] % (i + 1);
			[out[i], out[j]] = [out[j], out[i]];
		}
		return out;
	}

	function start() {
		tokens = shuffle(
			Array.from({ length: count }, (_, i): Alignment => (i < evil ? 'evil' : 'good'))
		);
		picked = undefined;
		phase = 'pick';
	}

	function pick(i: number) {
		if (phase !== 'pick' || !seatId) return;
		picked = i;
		phase = 'shown';
		grimoire.run({ type: 'SetAlignment', seatId, alignment: tokens[i] });
	}

	const title = $derived(
		phase === 'setup'
			? 'Alignment draw'
			: phase === 'pick'
				? 'Choose a token'
				: picked !== undefined && tokens[picked] === 'evil'
					? 'Evil'
					: 'Good'
	);
</script>

<Dialog bind:open {title} size="full">
	{#if seat && seatId}
		{#if phase === 'setup'}
			<p class="who">
				{#if seat.characterId}<CharacterBadge
						characterId={seat.characterId}
						character={characters.get(seat.characterId)}
						playerName={seatName(game, seatId)}
						inline
					/>{:else}{seatName(game, seatId)}{/if}
			</p>
			<dl class="counts">
				<dt>Tokens</dt>
				<dd>
					<IconButton
						icon="minus"
						label="Fewer tokens"
						disabled={count <= 1}
						onclick={() => (count -= 1)}
					/>
					<output aria-label="Tokens">{count}</output>
					<IconButton
						icon="add"
						label="More tokens"
						disabled={count >= MAX}
						onclick={() => (count += 1)}
					/>
				</dd>
				<dt>Evil</dt>
				<dd>
					<IconButton
						icon="minus"
						label="Fewer evil"
						disabled={evil <= 0}
						onclick={() => (evil -= 1)}
					/>
					<output aria-label="Evil tokens">{evil}</output>
					<IconButton
						icon="add"
						label="More evil"
						disabled={evil >= count}
						onclick={() => (evil += 1)}
					/>
				</dd>
				<dt>Good</dt>
				<dd><output aria-label="Good tokens">{count - evil}</output></dd>
			</dl>
		{:else}
			<!-- The player's view: face-down tokens, the counts never shown. -->
			<ol class="tiles" aria-label="Tokens">
				{#each tokens as alignment, i (i)}
					<li>
						<button
							type="button"
							class="tile"
							data-team={phase === 'shown' && picked === i ? alignment : undefined}
							disabled={phase === 'shown' && picked !== i}
							aria-label={phase === 'shown' && picked === i
								? `Token ${i + 1}: ${alignment === 'evil' ? 'Evil' : 'Good'}`
								: `Token ${i + 1}`}
							onclick={() => pick(i)}
						>
							<span class="face" aria-hidden="true"
								>{phase === 'shown' && picked === i
									? alignment === 'evil'
										? 'Evil'
										: 'Good'
									: i + 1}</span
							>
						</button>
					</li>
				{/each}
			</ol>
		{/if}
	{/if}
	{#snippet actions()}
		{#if phase === 'setup'}
			<Button variant="quiet" onclick={() => (open = false)}>Cancel</Button>
			<Button variant="accent" icon="forward" disabled={count < 1} onclick={start}
				>Hand to player</Button
			>
		{:else if phase === 'shown'}
			<Button variant="accent" icon="check" onclick={() => (open = false)}>Done</Button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.who {
		margin: 0 0 var(--space-3);
	}
	.counts {
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: 0;
	}
	.counts dd {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		margin: 0;
	}
	output {
		min-width: 2ch;
		font: 700 1.3rem var(--font-control);
		text-align: center;
	}
	/* The bag draw's face-down token look (features/setup DrawPage). */
	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(30%, calc(8 * var(--u))), 1fr));
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tile {
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 1;
		min-height: var(--tap-target);
		border: 0;
		border-radius: 50%;
		background: var(--token-face);
		color: var(--on-token);
		box-shadow: inset 0 0 0 0.2rem var(--token-rim);
		font: inherit;
		cursor: pointer;
	}
	.tile:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.tile[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.tile[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
	.face {
		font-size: 2.25rem;
		font-weight: 700;
		line-height: 1;
	}
	.tile[data-team] .face {
		font-size: 1.4rem;
	}
</style>
