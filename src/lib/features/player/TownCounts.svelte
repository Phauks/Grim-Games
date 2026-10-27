<script lang="ts">
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import { tablePlayersLine } from '#lib/features/modes/players-line.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';

	/**
	 * The players and the split by type, worked out from the seats so nobody counts (Trevor,
	 * 2026-10-26, plan E1): the standard split, which is all the table can know. A line of its
	 * own over the Grim tab's town, so the corner keeps its room among the seats.
	 */
	let { seats }: { seats: readonly PublicSeat[] } = $props();

	const counts = $derived(tablePlayersLine(seats));
</script>

<!-- eslint-disable-next-line grim/count-badge -- a sentence: "8 (5 Townsfolk, 1 Outsider, …)", as Game info's Players line -->
<p class="counts" data-testid="grim-counts">{t('modes.info.players')}: {counts}</p>

<style>
	.counts {
		margin: 0 0 var(--space-2);
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
