<script lang="ts">
	import type { NightMarker } from '#lib/core/data/index.ts';
	import PlayerNightOrder from '#lib/features/player/PlayerNightOrder.svelte';
	import type { PlayerNight, PlayerNightEntry } from '#lib/features/player/player-script.ts';
	import type { NightWalk } from '#lib/features/grimoire/night/night-walk.svelte.ts';

	/**
	 * Between nights, the pane's Night tab: both nights' steps for this game, as the Script's
	 * night order shows them, each night closing from its header (Trevor, 2026-11-16: "first
	 * night and other nights should be collapsible"). The next night first.
	 */
	interface Props {
		walk: NightWalk;
		/** Before Start game the first night is next; after it, the other nights. */
		setup: boolean;
	}

	let { walk, setup }: Props = $props();

	const nights = $derived.by((): PlayerNight[] => {
		const all = (['first', 'other'] as const).map((night) => ({
			night,
			entries: walk
				.upcoming(night)
				.flatMap((step): PlayerNightEntry[] =>
					step.kind === 'marker'
						? [{ kind: 'marker', id: step.id as NightMarker }]
						: step.character
							? [{ kind: 'character', character: step.character, text: step.reminder }]
							: []
				)
		}));
		return setup ? all : all.reverse();
	});
</script>

<div class="night-pane">
	<PlayerNightOrder {nights} storageKey="board:night" />
</div>

<style>
	.night-pane {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
	}
</style>
