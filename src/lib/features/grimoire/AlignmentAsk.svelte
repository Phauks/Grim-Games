<script lang="ts">
	import { seatNumber } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * Marking a player as truly an evil character (the Marionette's "Is The Marionette",
	 * https://wiki.bloodontheclocktower.com/Marionette) asks whether to make them evil
	 * (Trevor, 2026-10-17), wherever the reminder was placed from. Cancel leaves the
	 * alignment as it is.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const ask = $derived(grimoire.alignmentAsk);
	const seat = $derived(ask ? grimoire.game.seats[ask.seatId] : undefined);
	const label = $derived.by(() => {
		if (!ask || !seat) return '';
		const n = seatNumber(grimoire.game, ask.seatId);
		return seat.playerName ? `Seat ${n} (${seat.playerName})` : `Seat ${n}`;
	});

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
					inline
				/>
			</dd>
			<dt>Current alignment</dt>
			<dd>
				<strong class="team" data-team={seat.alignment ?? 'neutral'}
					>{seat.alignment === 'good' ? 'Good' : 'Not set'}</strong
				>
			</dd>
			<dt>New alignment</dt>
			<dd><strong class="team" data-team="evil">Evil</strong></dd>
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
	.team {
		display: inline-block;
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		background: var(--surface-raised);
		color: var(--on-surface);
	}
	.team[data-team='good'] {
		background: var(--good);
		color: var(--on-good);
	}
	.team[data-team='evil'] {
		background: var(--evil);
		color: var(--on-evil);
	}
</style>
