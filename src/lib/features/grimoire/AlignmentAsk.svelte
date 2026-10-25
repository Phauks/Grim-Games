<script lang="ts">
	import AlignmentPill from './AlignmentPill.svelte';
	import { seatNumber, type SeatId } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Marking a player as truly an evil character (the Marionette's "Is The Marionette",
	 * https://wiki.bloodontheclocktower.com/Marionette) asks whether to make them evil
	 * (Trevor, 2026-10-17), wherever the reminder was placed from. Cancel leaves the
	 * alignment as it is. The same for a reminder that says the player became the Demon (the
	 * Scarlet Woman's "Is The Demon", https://wiki.bloodontheclocktower.com/Scarlet_Woman;
	 * Trevor, 2026-10-19): it asks whether to change their character to that Demon.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const ask = $derived(grimoire.alignmentAsk);
	const seat = $derived(ask ? grimoire.game.seats[ask.seatId] : undefined);
	function seatName(seatId: SeatId): string {
		const n = seatNumber(grimoire.game, seatId);
		const name = grimoire.game.seats[seatId]?.playerName;
		return name ? `Seat ${n} (${name})` : `Seat ${n}`;
	}
	const label = $derived(ask ? seatName(ask.seatId) : '');

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

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way (Cancel, Escape, the close button): the question is answered.
	$effect(() => {
		if (!open) grimoire.alignmentAsk = undefined;
	});

	function confirm() {
		if (ask) grimoire.run({ type: 'SetAlignment', seatId: ask.seatId, alignment: 'evil' });
		grimoire.alignmentAsk = undefined;
	}
</script>

<ConfirmDialog
	bind:open
	title="Make this player evil?"
	onConfirm={confirm}
	onCancel={() => (grimoire.alignmentAsk = undefined)}
>
	{#if ask && seat}
		<dl class="change">
			<dt>Player</dt>
			<dd><strong>{label}</strong></dd>
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
			<dd><AlignmentPill alignment="evil" /></dd>
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
			<dd><strong>{seatName(demon.seatId)}</strong></dd>
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
