<script lang="ts">
	import { seatNumber } from '#lib/core/model/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import GlossaryText from '#lib/features/glossary/GlossaryText.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A Fool marked dead whose ability is unused and works (Trevor, 2026-10-22): the first time
	 * the Fool dies, they don't (https://wiki.bloodontheclocktower.com/Fool), except to the
	 * Assassin. Confirm keeps them alive and places their "No Ability" reminder; Cancel leaves
	 * the death as marked. Rules: `foolSurvives` in core.
	 */
	interface Props {
		grimoire: Grimoire;
	}

	let { grimoire }: Props = $props();

	const ask = $derived(grimoire.foolAsk);
	const fool = $derived(grimoire.open.characters.get('fool'));
	const label = $derived.by(() => {
		if (!ask) return '';
		const n = seatNumber(grimoire.game, ask.seatId);
		const name = grimoire.game.seats[ask.seatId]?.playerName;
		return name ? `Seat ${n} (${name})` : `Seat ${n}`;
	});

	let open = $state(false);
	$effect(() => {
		if (ask) open = true;
	});
	// Closed any way (Cancel, Escape, the close button): the question is answered.
	$effect(() => {
		if (!open) grimoire.foolAsk = undefined;
	});

	function keepAlive() {
		if (!ask) return;
		const { seatId } = ask;
		if (grimoire.run({ type: 'SetDead', seatId, dead: false }))
			grimoire.run({
				type: 'AddReminder',
				seatId,
				reminder: { characterId: 'fool', label: 'No Ability' }
			});
		grimoire.foolAsk = undefined;
	}
</script>

<ConfirmDialog
	bind:open
	title="Keep the Fool alive?"
	onConfirm={keepAlive}
	onCancel={() => (grimoire.foolAsk = undefined)}
>
	{#if ask && fool}
		<p class="ability">
			<CharacterBadge characterId="fool" character={fool} />
			<GlossaryText text={fool.ability} names={[fool.name]} />
		</p>
		<dl class="change">
			<dt>Player</dt>
			<dd><strong>{label}</strong></dd>
			<dt>Places</dt>
			<dd>No Ability</dd>
		</dl>
	{/if}
</ConfirmDialog>

<style>
	.ability {
		margin: 0 0 var(--space-2);
	}
	.change {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
		align-items: center;
		margin: 0;
	}
	.change dt {
		color: var(--on-surface-muted);
		font-size: 0.85rem;
	}
	.change dd {
		margin: 0;
	}
</style>
