<!--
	A setup suggestion from the reminder bank (ReminderBank): what it is for, the seats it is
	suggested for, and Dismiss or Choose seat.
-->
<script lang="ts">
	import type { SeatId } from '#lib/core/model/index.ts';
	import { characterNames } from '#lib/core/rules/character-names.ts';
	import { prepTextSegments } from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { traySeats, type TrayItem } from './setup-tray.ts';

	interface Props {
		grimoire: Grimoire;
		open: boolean;
		shown: TrayItem | undefined;
		/** Loose mode gives nothing to a seat: it is dragged onto the board. */
		loose: boolean;
		onPlace: (seatId: SeatId) => void;
		onDismiss: () => void;
		/** Any seat will do (a Drunk decided later goes anywhere). */
		onChooseSeat: () => void;
	}

	let {
		grimoire,
		open = $bindable(),
		shown,
		loose,
		onPlace,
		onDismiss,
		onChooseSeat
	}: Props = $props();

	const game = $derived(grimoire.game);
	const characters = $derived(grimoire.open.characters);
	const names = $derived(characterNames([...characters.values()]));
</script>

<Dialog bind:open title="Setup reminder">
	{#snippet heading()}
		{#if shown}<ReminderToken
				label={shown.suggestion.label}
				character={characters.get(shown.suggestion.characterId)}
			/>{/if}
	{/snippet}
	{#snippet subtitle()}
		{#if shown}<CharacterBadge
				characterId={shown.suggestion.characterId}
				character={characters.get(shown.suggestion.characterId)}
			/>{/if}
	{/snippet}
	{#if shown}
		{@const s = shown.suggestion}
		{@const owner = characters.get(s.characterId)}
		<p class="text">
			{#each prepTextSegments(s.text, names) as part, j (j)}{#if part.kind === 'reminder'}<ReminderToken
						label={part.label}
						character={owner}
					/>{:else if part.kind === 'character'}<CharacterBadge
						characterId={part.id}
						character={characters.get(part.id)}
					/>{:else}{part.text}{/if}{/each}
		</p>
		<!-- Loose mode gives nothing to a seat: it is dragged onto the board. -->
		{#if !loose}
			{@const seats = traySeats(s)}
			<p class="hint">
				{seats.length > 0
					? 'Suggested seats, or drag it onto any seat.'
					: 'Drag it onto any seat, or choose one.'}
			</p>
			<ul class="seats">
				{#each seats as seatId (seatId)}
					{@const id = game.seats[seatId]?.characterId}
					<li>
						{#if id}
							<CharacterBadge
								characterId={id}
								character={characters.get(id)}
								alignment={game.seats[seatId].alignment}
								playerName={seatName(game, seatId)}
							/>
						{:else}
							<PlayerBadge name={seatName(game, seatId)} />
						{/if}
						<span class="spacer"></span>
						<Button
							variant="quiet"
							aria-label={`Place on ${seatName(game, seatId)}`}
							onclick={() => onPlace(seatId)}>Place</Button
						>
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
	{#snippet actions()}
		<Button variant="quiet" icon="close" onclick={onDismiss}>Dismiss</Button>
		<!-- Any seat will do (a Drunk decided later goes anywhere). -->
		<Button variant="quiet" disabled={loose} onclick={onChooseSeat}>Choose seat</Button>
		<Button variant="quiet" onclick={() => (open = false)}>Close</Button>
	{/snippet}
</Dialog>

<style>
	.text {
		margin: 0 0 var(--space-2);
		line-height: 1.9;
	}
	.hint {
		margin: 0 0 var(--space-1);
		font-size: 0.9rem;
		color: var(--on-surface-muted);
	}
	.seats {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.seats li {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.spacer {
		flex: 1;
	}
</style>
