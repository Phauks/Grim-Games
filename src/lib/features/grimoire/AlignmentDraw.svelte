<script lang="ts">
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import type { Alignment } from '#lib/core/data/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import { readParsed, writeStored } from '#lib/ui/stored.ts';
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
	// The last mix is kept on this device (Trevor, 2026-10-19), never with the game.
	const KEY = 'grim-games:alignment-draw:v1';
	function parseMix(raw: unknown): { count: number; evil: number } {
		const { count, evil } = (raw ?? {}) as Record<string, unknown>;
		if (!Number.isInteger(count) || !Number.isInteger(evil)) return { count: 4, evil: 1 };
		const c = Math.min(MAX, Math.max(1, count as number));
		return { count: c, evil: Math.min(c, Math.max(0, evil as number)) };
	}
	const saved = readParsed(KEY, parseMix);
	let count = $state(saved.count);
	let evil = $state(saved.evil);
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

	/** The chance of drawing one of `n` tokens, whole percent (Trevor, 2026-10-19). */
	const percent = (n: number) => `${Math.round((100 * n) / count)}%`;

	function start() {
		writeStored(KEY, { count, evil });
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
					/>{:else}<PlayerBadge name={seatName(game, seatId)} />{/if}
			</p>
			<!--
				One line with the mix and each side's chance (Trevor, 2026-10-19): Good on the left,
				Evil on the right, a bar between them split by share. Fixed widths, so changing a
				count moves nothing.
			-->
			<div class="mix" data-testid="draw-mix">
				<span class="side" data-team="good" data-testid="good-chance"
					>Good {count - evil} · {percent(count - evil)}</span
				>
				<span class="bar" aria-hidden="true">
					<span class="part" data-team="good" style:flex-grow={count - evil}></span>
					<span class="part" data-team="evil" style:flex-grow={evil}></span>
				</span>
				<span class="side end" data-team="evil" data-testid="evil-chance"
					>Evil {evil} · {percent(evil)}</span
				>
			</div>
			<div class="counts">
				<span class="count">
					<span aria-hidden="true">Tokens</span>
					<NumberSelect
						bind:value={count}
						label={t('setup.alignmentDraw.tokens')}
						hideLabel
						min={1}
						max={MAX}
					/>
				</span>
				<span class="count">
					<span aria-hidden="true">Evil</span>
					<NumberSelect
						bind:value={evil}
						label={t('setup.alignmentDraw.evilTokens')}
						hideLabel
						max={count}
					/>
				</span>
			</div>
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
			<ModalActions onCancel={() => (open = false)} onConfirm={start} disabled={count < 1} />
		{:else if phase === 'shown'}
			<Button variant="accent" icon="check" onclick={() => (open = false)}>Done</Button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.who {
		margin: 0 0 var(--space-3);
	}
	.mix {
		display: grid;
		grid-template-columns: auto minmax(calc(3 * var(--u)), 1fr) auto;
		align-items: center;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
		font-variant-numeric: tabular-nums;
	}
	/* Wide enough for "Good 8 · 100%", so a changing count never moves the bar. */
	.side {
		min-width: 12ch;
		font-weight: 600;
	}
	.side.end {
		text-align: end;
	}
	.bar {
		display: flex;
		height: 0.9rem;
		overflow: hidden;
		border-radius: var(--radius-pill, 999rem);
		background: var(--surface-raised);
	}
	.part {
		flex-basis: 0;
	}
	.part[data-team='good'] {
		background: var(--good);
	}
	.part[data-team='evil'] {
		background: var(--evil);
	}
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-4);
	}
	.count {
		display: flex;
		align-items: center;
		gap: var(--space-2);
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
