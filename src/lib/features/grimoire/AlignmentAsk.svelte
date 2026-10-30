<script lang="ts">
	import AlignmentPill from './AlignmentPill.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Marking a player as truly an evil character (the Marionette's "Is The Marionette",
	 * https://wiki.bloodontheclocktower.com/Marionette) asks whether to make them evil
	 * (Trevor, 2026-10-17), wherever the reminder was placed from. Cancel leaves the
	 * alignment as it is. The same for a reminder that says the player became the Demon (the
	 * Scarlet Woman's "Is The Demon", https://wiki.bloodontheclocktower.com/Scarlet_Woman;
	 * Trevor, 2026-10-19): it asks whether to change their character to that Demon. Taking off
	 * the Mezepheles's "Turns Evil" asks to make that player evil
	 * (https://wiki.bloodontheclocktower.com/Mezepheles); the Snake Charmer's "Poisoned" on the
	 * Demon asks to swap their characters and alignments
	 * (https://wiki.bloodontheclocktower.com/Snake_Charmer). The Goon's Drunk and the Ogre's
	 * Friend ask to give the Goon or Ogre the carrier's alignment
	 * (https://wiki.bloodontheclocktower.com/Goon, https://wiki.bloodontheclocktower.com/Ogre).
	 * Rules: `becomesOffer` in core.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const ask = $derived(grimoire.alignmentAsk);
	const seat = $derived(ask ? grimoire.game.seats[ask.seatId] : undefined);

	const demon = $derived(grimoire.demonAsk);
	const demonSeat = $derived(demon ? grimoire.game.seats[demon.seatId] : undefined);
	let demonOpen = $state(false);
	$effect(() => {
		if (demon) demonOpen = true;
	});
	$effect(() => {
		if (!demonOpen) grimoire.demonAsk = undefined;
	});
	function becomeDemon() {
		if (demon)
			grimoire.run({
				type: 'AssignCharacter',
				seatId: demon.seatId,
				characterId: demon.characterId,
				alignment: 'evil'
			});
		grimoire.demonAsk = undefined;
	}

	const swap = $derived(grimoire.swapAsk);
	let swapOpen = $state(false);
	$effect(() => {
		if (swap) swapOpen = true;
	});
	$effect(() => {
		if (!swapOpen) grimoire.swapAsk = undefined;
	});
	function swapCharacters() {
		if (swap) grimoire.run({ type: 'SwapCharacters', ...swap });
		grimoire.swapAsk = undefined;
	}

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way (Cancel, Escape, the close button): the question is answered.
	$effect(() => {
		if (!open) grimoire.alignmentAsk = undefined;
	});

	function confirm() {
		if (ask) grimoire.run({ type: 'SetAlignment', seatId: ask.seatId, alignment: ask.alignment });
		grimoire.alignmentAsk = undefined;
	}
</script>

<ConfirmDialog
	bind:open
	title={`Make this player ${ask?.alignment ?? 'evil'}?`}
	onConfirm={confirm}
	onCancel={() => (grimoire.alignmentAsk = undefined)}
>
	{#if ask && seat}
		<dl class="change">
			<dt>Player</dt>
			<dd>
				{#if ask}<PlayerBadge name={seatName(grimoire.game, ask.seatId)} />{/if}
			</dd>
			<dt>Character</dt>
			<dd>
				<CharacterBadge
					characterId={ask.characterId}
					character={grimoire.open.characters.get(ask.characterId)}
				/>
			</dd>
			<dt>Current alignment</dt>
			<dd>
				<AlignmentPill alignment={seat.alignment} />
			</dd>
			<dt>New alignment</dt>
			<dd><AlignmentPill alignment={ask.alignment} /></dd>
		</dl>
	{/if}
</ConfirmDialog>

<ConfirmDialog
	bind:open={demonOpen}
	title="Change into the Demon?"
	onConfirm={becomeDemon}
	onCancel={() => (grimoire.demonAsk = undefined)}
>
	{#if demon && demonSeat}
		<dl class="change">
			<dt>Player</dt>
			<dd><PlayerBadge name={seatName(grimoire.game, demon.seatId)} /></dd>
			<dt>Current character</dt>
			<dd>
				{#if demonSeat.characterId}<CharacterBadge
						characterId={demonSeat.characterId}
						character={grimoire.open.characters.get(demonSeat.characterId)}
					/>{:else}None{/if}
			</dd>
			<dt>New character</dt>
			<dd>
				<CharacterBadge
					characterId={demon.characterId}
					character={grimoire.open.characters.get(demon.characterId)}
				/>
			</dd>
			<dt>Alignment</dt>
			<dd><AlignmentPill alignment="evil" /></dd>
		</dl>
	{/if}
</ConfirmDialog>

{#snippet change(seatId: SeatId, from: SeatId)}
	{@const now = grimoire.game.seats[seatId]}
	{@const next = grimoire.game.seats[from]}
	<dt>Player</dt>
	<dd><PlayerBadge name={seatName(grimoire.game, seatId)} /></dd>
	<dt>New character</dt>
	<dd>
		{#if next?.characterId}<CharacterBadge
				characterId={next.characterId}
				character={grimoire.open.characters.get(next.characterId)}
			/>{/if}
	</dd>
	<dt>New alignment</dt>
	<dd>
		{#if next?.alignment && now}<AlignmentPill alignment={next.alignment} />{/if}
	</dd>
{/snippet}

<ConfirmDialog
	bind:open={swapOpen}
	title="Swap characters and alignments?"
	onConfirm={swapCharacters}
	onCancel={() => (grimoire.swapAsk = undefined)}
>
	{#if swap}
		<dl class="change" data-testid="swap-ask">
			{@render change(swap.seatId, swap.withSeatId)}
			{@render change(swap.withSeatId, swap.seatId)}
		</dl>
	{/if}
</ConfirmDialog>

<style>
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		margin: 0 0 var(--space-2);
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
</style>
