<script lang="ts">
	import type { CandleState, SeatConnection } from '#lib/core/sync/seat-presence.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';

	/**
	 * Which players have connected, opened from the candles beside Setup (Trevor, 2026-10-29:
	 * "clicking the candle modal should show you which players have connected"): every seat in
	 * order with its phone connected, away or missing, then the phones in the room with no seat.
	 * The same list on a phone, in the Storyteller's player view and in character selection.
	 */
	interface Props {
		open: boolean;
		connections: readonly SeatConnection[];
		/** Connected phones with no seat. */
		unseated: number;
		/** Their names, where they are known (the Storyteller's room); a phone has only the count. */
		unseatedNames?: readonly string[];
	}

	let { open = $bindable(), connections, unseated, unseatedNames = [] }: Props = $props();

	function stateLabel(state: CandleState): string {
		if (state === 'lit') return t('day.connected.here');
		return state === 'away' ? t('day.connected.away') : t('day.connected.none');
	}
	const lit = $derived(connections.filter((c) => c.state === 'lit').length);
</script>

<Dialog
	bind:open
	title={t('day.connected.title')}
	description={t('day.candlesLabel', { lit, total: connections.length })}
>
	<ul class="seats" data-testid="connected-seats">
		{#each connections as seat (seat.seatId)}
			<li data-testid="connected-seat" data-state={seat.state}>
				<span class="who"
					><PlayerBadge
						name={seat.playerName ?? t('common.seat', { number: seat.seatNumber })}
					/></span
				>
				<span class="state">{stateLabel(seat.state)}</span>
			</li>
		{:else}
			<li>{t('common.none')}</li>
		{/each}
		<!-- Kept when there are none, so the list's end never moves. -->
		<li data-testid="connected-unseated">
			<span class="who">{t('day.connected.unseated')}</span>
			<span class="state"
				>{#if unseatedNames.length}<span class="names"
						>{#each unseatedNames as name, i (i)}<PlayerBadge {name} />{/each}</span
					>{:else if unseated}{unseated}{:else}{t('common.none')}{/if}</span
			>
		</li>
	</ul>
</Dialog>

<style>
	.seats {
		display: grid;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Rows with dividers, not bordered cards (Trevor), as Characters on phones. */
	.seats li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
		border-bottom: 1px solid var(--border);
	}
	.who {
		min-width: 0;
	}
	.state {
		flex: none;
		max-width: 60%;
		color: var(--on-surface-muted);
	}
	li[data-state='lit'] .state {
		color: var(--on-surface);
		font-weight: 600;
	}
	.names {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--space-1);
	}
</style>
