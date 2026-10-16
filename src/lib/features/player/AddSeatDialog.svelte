<script lang="ts">
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { MAX_SEATS, type NotebookSeat } from './notebook.ts';

	/**
	 * Adding a seat on purpose (Trevor, 2026-10-16): say who sits down (a player or a
	 * Traveller), then where, between which two seats. A Traveller is then claimed from the
	 * script's Travellers, so the new seat shows who it is straight away.
	 */
	interface Props {
		open?: boolean;
		seats: readonly NotebookSeat[];
		/** Travellers to claim the new seat as: the script's own, then recommended ones. */
		travellers: readonly Character[];
		/** Adds the seat at `index` in the seating order, with its claims; returns nothing. */
		onAdd: (index: number, claims: CharacterId[]) => void;
	}

	let { open = $bindable(false), seats, travellers, onAdd }: Props = $props();

	let kind = $state<'player' | 'traveller'>('player');
	/** Where the Traveller will sit, while their character is chosen. */
	let at = $state<number | undefined>();
	let query = $state('');

	// Starts over each time it opens.
	$effect(() => {
		if (!open) return;
		kind = 'player';
		at = undefined;
		query = '';
	});

	const label = (i: number) => {
		const seat = seats[i];
		const number = t('common.seat', { number: i + 1 });
		return seat?.name ? `${number} · ${seat.name}` : number;
	};
	/** Between each pair of neighbours, the last place wrapping round to Seat 1. */
	const places = $derived(
		seats.map((_, i) => ({
			index: i + 1,
			text: t('player.between', { first: label(i), second: label((i + 1) % seats.length) })
		}))
	);

	function choosePlace(index: number) {
		if (kind === 'traveller' && travellers.length) {
			at = index;
			return;
		}
		open = false;
		onAdd(index, []);
	}
	function chooseTraveller(id: CharacterId) {
		if (at === undefined) return;
		open = false;
		onAdd(at, [id]);
	}
</script>

<Dialog
	bind:open
	title={at === undefined ? t('player.addSeatTitle') : t('player.whichTraveller')}
	size="full"
>
	{#if at === undefined}
		<div class="body">
			<div class="kind" role="group" aria-label={t('player.whoSitsDown')}>
				<Button
					variant={kind === 'player' ? 'accent' : 'quiet'}
					aria-pressed={kind === 'player'}
					onclick={() => (kind = 'player')}>{t('player.kindPlayer')}</Button
				>
				<Button
					variant={kind === 'traveller' ? 'accent' : 'quiet'}
					aria-pressed={kind === 'traveller'}
					onclick={() => (kind = 'traveller')}>{t('player.kindTraveller')}</Button
				>
			</div>
			<h3 class="where">{t('player.where')}</h3>
			{#if seats.length >= MAX_SEATS}
				<p class="none">{t('player.seatsFull', { count: MAX_SEATS })}</p>
			{:else}
				<ul>
					{#each places as place (place.index)}
						<li>
							<button
								type="button"
								class="place"
								data-place={place.index}
								onclick={() => choosePlace(place.index)}>{place.text}</button
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else}
		<div class="picker">
			<CharacterPicker characters={travellers} onSelect={chooseTraveller} bind:query />
		</div>
	{/if}
	{#snippet actions()}
		{#if at !== undefined}
			<Button variant="quiet" onclick={() => (at = undefined)}>{t('player.back')}</Button>
		{/if}
		<Button variant="quiet" onclick={() => (open = false)}>{t('common.cancel')}</Button>
	{/snippet}
</Dialog>

<style>
	.body {
		display: grid;
		align-content: start;
		gap: var(--space-3);
		height: 100%;
		min-height: 0;
	}
	.kind {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.where {
		margin: 0;
		font-size: 1rem;
		color: var(--heading);
	}
	ul {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
		overflow-y: auto;
	}
	.place {
		width: 100%;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		text-align: left;
		cursor: pointer;
		touch-action: manipulation;
	}
	.place:hover {
		background: var(--surface-selected);
	}
	.none {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.picker {
		display: grid;
		height: 100%;
		min-height: 0;
	}
</style>
