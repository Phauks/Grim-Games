<script lang="ts">
	import type { Alignment, Character } from '#lib/core/data/index.ts';
	import CharacterToken from '#lib/features/characters/CharacterToken.svelte';
	import ChoiceGroup from '#lib/ui/primitives/ChoiceGroup.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';

	interface Props {
		open: boolean;
		/** The tile's number on the draw screen. */
		number: number;
		/** What the player sees: never the grimoire character (the Drunk sees a Townsfolk). */
		shows: Character;
		/** The grimoire character is a Traveller, whose alignment the Storyteller sets. */
		needsAlignment: boolean;
		/** "Seat 3", the seat the draw goes to. */
		seatLabel: string;
		playerName: string;
		onConfirm: (details: { playerName: string; alignment?: Alignment }) => void;
		onPutBack: () => void;
	}

	let {
		open = $bindable(),
		number,
		shows,
		needsAlignment,
		seatLabel,
		playerName,
		onConfirm,
		onPutBack
	}: Props = $props();

	let name = $state('');
	let alignment = $state<Alignment | ''>('');
	$effect(() => {
		if (open) {
			name = playerName;
			alignment = '';
		}
	});
</script>

<!--
	The player's own reveal. Closing it keeps the tile in their hand (the draw is saved), so
	backing out never loses it; Put back returns it to the bag.
-->
<Dialog bind:open title="Tile {number}" size="full">
	<div class="reveal" data-testid="reveal">
		<p class="seat">{seatLabel}</p>
		<div class="token">
			<CharacterToken character={shows} size={160} />
		</div>
		<p class="name" data-testid="reveal-name">{shows.name}</p>
		<p class="ability">{shows.ability}</p>
		<label class="player">
			<span>Name</span>
			<input type="text" autocomplete="off" placeholder="None" bind:value={name} />
		</label>
		<div class="alignment" aria-hidden={!needsAlignment}>
			{#if needsAlignment}
				<ChoiceGroup
					label="Alignment"
					layout="row"
					value={alignment}
					options={[
						{ value: 'good', label: 'Good' },
						{ value: 'evil', label: 'Evil' }
					]}
					onChange={(v) => (alignment = v)}
				/>
			{/if}
		</div>
	</div>
	{#snippet actions()}
		<Button variant="quiet" onclick={onPutBack}>Put back</Button>
		<Button
			variant="accent"
			disabled={needsAlignment && alignment === ''}
			onclick={() => onConfirm({ playerName: name, ...(alignment !== '' ? { alignment } : {}) })}
			>Confirm</Button
		>
	{/snippet}
</Dialog>

<style>
	.reveal {
		display: grid;
		flex: 1;
		align-content: start;
		justify-items: center;
		gap: var(--space-2);
		overflow-y: auto;
		text-align: center;
	}
	.seat {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.token {
		display: grid;
		place-items: center;
		width: 160px;
		height: 160px;
	}
	.name {
		margin: 0;
		font-family: var(--font-character);
		font-weight: var(--font-character-weight);
		font-size: 1.6rem;
		color: var(--heading);
	}
	.ability {
		max-width: 28rem;
		margin: 0;
		font-family: var(--font-ability);
	}
	.player {
		display: grid;
		gap: var(--space-1);
		width: min(100%, 20rem);
		text-align: start;
	}
	.player input {
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		color: var(--on-surface);
		font: inherit;
		font-family: var(--font-player);
	}
	/* Space for the Traveller's alignment is always reserved, so the actions never move. */
	.alignment {
		min-height: calc(2 * var(--tap-target));
	}
</style>
