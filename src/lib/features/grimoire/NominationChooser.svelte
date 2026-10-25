<script lang="ts">
	import type { CharacterLookup, SeatId } from '#lib/core/model/index.ts';
	import {
		mayNominate,
		nominationsPerDay,
		seatNominations,
		todaysNominations
	} from '#lib/core/rules/index.ts';
	import { seatLabel } from '#lib/features/game/seat-label.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';
	import { recordNomination } from './record-nomination.ts';
	import SeatChooser from './SeatChooser.svelte';

	/**
	 * Who a seat nominated today (`made`), or who nominated it (`received`), for the board's
	 * nomination marks and the seat sheet's rows (Track nominations). Each row shows whether
	 * that player has nominated and been nominated today (Trevor, 2026-10-24), and only players
	 * who may nominate are offered as the nominator: not the dead, unless their character says
	 * so (`mayNominate`, https://wiki.bloodontheclocktower.com/Glossary, "Nomination").
	 */
	interface Props {
		grimoire: Grimoire;
		characters: CharacterLookup;
		/** The seat and the side being chosen; undefined while closed. */
		asking?: { seatId: SeatId; side: 'made' | 'received' };
		/** A nomination was recorded or changed: what it sets off (NominationAsk). */
		onNominated?: (nomination: { nominator: SeatId; nominee: SeatId }) => void;
	}

	let { grimoire, characters, asking = $bindable(), onNominated }: Props = $props();

	const game = $derived(grimoire.game);
	const today = $derived.by(() => {
		const all = todaysNominations(game);
		return {
			made: new Set(all.map((n) => n.nominator)),
			received: new Set(all.map((n) => n.nominee))
		};
	});

	function choose(other: SeatId | undefined) {
		const ask = asking;
		asking = undefined;
		if (!ask) return;
		// A player with nominations left today (the Banshee killed by the Demon) makes another.
		const another =
			ask.side === 'made' &&
			seatNominations(game, ask.seatId).allMade.length <
				nominationsPerDay(game, ask.seatId, characters);
		const pair = recordNomination(grimoire, ask.seatId, ask.side, other, another);
		if (pair) onNominated?.(pair);
	}
</script>

<!-- Bound both ways, so closing it with ✕ or Escape lets the same marks open it again. -->
<SeatChooser
	bind:open={() => asking !== undefined, (open) => !open && (asking = undefined)}
	title={asking === undefined
		? ''
		: asking.side === 'received'
			? `Who nominated ${seatLabel(game, asking.seatId)}?`
			: `Who did ${seatLabel(game, asking.seatId)} nominate?`}
	{game}
	{characters}
	exclude={asking?.seatId}
	offer={asking?.side === 'received'
		? (seatId) => today.made.has(seatId) || mayNominate(game, seatId, characters)
		: undefined}
	onNone={() => choose(undefined)}
	onChoose={(other) => choose(other)}
>
	{#snippet rowMarks(seatId: SeatId)}
		{@const made = today.made.has(seatId)}
		{@const received = today.received.has(seatId)}
		<span
			class="slot"
			role="img"
			data-testid="chooser-nominator-mark"
			data-on={made || undefined}
			aria-label={made ? 'Has nominated today' : 'Has not nominated today'}
			title={made ? 'Has nominated today' : 'Has not nominated today'}
			><Icon name="nominator" /></span
		>
		<span
			class="slot"
			role="img"
			data-testid="chooser-nominated-mark"
			data-on={received || undefined}
			aria-label={received ? 'Was nominated today' : 'Not nominated today'}
			title={received ? 'Was nominated today' : 'Not nominated today'}
			><Icon name="nominated" /></span
		>
	{/snippet}
</SeatChooser>

<style>
	/* The seat token's nomination marks (SeatToken): greyed until it happens, then one neutral
	   fill, as red or blue would read as an alignment. */
	.slot {
		display: grid;
		place-items: center;
		width: calc(1.25 * var(--u));
		height: calc(1.25 * var(--u));
		border-radius: 50%;
		color: var(--on-surface-muted);
		opacity: 0.5;
		--icon-size: calc(0.875 * var(--u));
	}
	.slot[data-on] {
		background: var(--on-surface);
		color: var(--surface);
		opacity: 1;
	}
</style>
