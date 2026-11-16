<script lang="ts">
	import type { Command } from '#lib/core/engine/index.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import CountOffDialog from '#lib/features/room/CountOffDialog.svelte';
	import TravellerPickDialog from '#lib/features/room/TravellerPickDialog.svelte';

	/**
	 * The dialogs Players opens over the board on every screen: Count off and the Travellers'
	 * choice. Players itself is a tab of the board's pane (plan M86, StorytellerPane).
	 */
	let { game, run }: { game: OpenGame; run?: (command: Command) => boolean } = $props();
</script>

<CountOffDialog {game} {run} />
<TravellerPickDialog {game} {run} />
