<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import CountBadge from '#lib/ui/primitives/CountBadge.svelte';
	import RotateSeats from '#lib/features/grimoire/seats/RotateSeats.svelte';
	import PaneFooter from '#lib/ui/layout/PaneFooter.svelte';
	import { sidePane } from '#lib/features/room/side-pane.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import type { SeatArranging } from '#lib/features/board/seat-arranging.svelte.ts';
	import type { Grimoire } from '#lib/features/grimoire/grimoire.svelte.ts';
	import {
		countOff,
		enterSeating,
		leaveSeating,
		letPhonesMove,
		seatingInPane
	} from '#lib/features/grimoire/seats/seating-mode.svelte.ts';

	/**
	 * More's Seats (moved from the board's ⋯ menu into the pane, Trevor 2026-11-18): a Fabled or
	 * Loric to add, and Seating. Beside the board, Seating's controls are here, under its own
	 * heading, with Rotate and Done in the pane's footer, and the top bar stays as it is (Trevor,
	 * 2026-11-19: "move those into the right side near the other controls"). On a phone Seating
	 * swaps the top bar for its own (BoardToolbar).
	 */
	interface Props {
		grimoire: Grimoire;
		seatArr: SeatArranging;
		onAddRule: () => void;
		/** Places a new seat, then comes back to Seating. */
		onAddSeat: () => void;
	}

	let { grimoire, seatArr, onAddRule, onAddSeat }: Props = $props();
	const host = roomHost();
	const count = $derived(host.countOff);
	const here = $derived(seatArr.arranging && seatingInPane());
	const seatingAction = $derived(t(host.seatingOpen ? 'room.seating.lock' : 'room.seating.unlock'));

	/** A phone's sheet closes first, so what the item opens or starts is on the board. */
	function act(action: () => void) {
		sidePane.hide();
		action();
	}
</script>

<div class="seats" data-testid="pane-seats">
	<div class="items">
		<Button variant="quiet" icon="fabled" onclick={() => act(onAddRule)}>Add Fabled or Loric</Button
		>
		{#if here}
			<h3 class="heading">{t('room.seating.title')}</h3>
			<Button variant="quiet" icon="add" aria-label="Add seat" onclick={onAddSeat}>Add seat</Button>
			<!-- The padlock shows which, never a colour; the words say what a tap does. -->
			<Button
				variant="quiet"
				icon={host.seatingOpen ? 'unlock' : 'lock'}
				aria-label={seatingAction}
				onclick={() => letPhonesMove(!host.seatingOpen)}>{seatingAction}</Button
			>
			<Button
				variant="quiet"
				icon="countOff"
				aria-label={t('room.countOff.title')}
				onclick={countOff}
				>{t('room.countOff.title')}{#if count}<span class="count"
						><CountBadge count={count.tokens.length} total={count.size} /></span
					>{/if}</Button
			>
			<Button
				variant="quiet"
				icon="spread"
				aria-label="Distribute"
				disabled={Object.keys(grimoire.layout.placed).length === 0 &&
					Object.keys(grimoire.layout.gaps).length === 0}
				onclick={() => seatArr.spread()}>Distribute</Button
			>
		{:else}
			<Button
				variant="quiet"
				icon="arrange"
				data-testid="menu-seating"
				onclick={() => act(() => enterSeating(seatArr))}
			>
				{t('room.seating.title')}
			</Button>
		{/if}
	</div>
	{#if here}
		<PaneFooter>
			<RotateSeats {grimoire} />
			<span class="spacer"></span>
			<Button
				variant="accent"
				icon="check"
				aria-label="Done"
				data-way-back
				onclick={() => leaveSeating(seatArr, grimoire)}>Done</Button
			>
		</PaneFooter>
	{/if}
</div>

<style>
	.seats {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
	.items {
		display: grid;
		flex: 1;
		align-content: start;
		gap: var(--space-2);
		min-height: 0;
		padding-inline: var(--pane-gutter, 0rem);
		overflow-y: auto;
	}
	.heading {
		margin: var(--space-2) 0 0;
		font-family: var(--font-control);
		font-size: 1rem;
		color: var(--heading);
	}
	.items :global(.button:has(> .count)) {
		position: relative;
	}
	.count {
		position: absolute;
		top: 0.15em;
		right: 0.15em;
		font-size: 0.75rem;
		pointer-events: none;
	}
	.spacer {
		flex: 1;
	}
</style>
