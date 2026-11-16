<script lang="ts">
	import type { LoadedScript } from '#lib/core/data/index.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import { gameShareable } from '#lib/features/scripts/game-shareable.svelte.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import { scriptVersion } from '#lib/features/player/player-script.ts';

	/**
	 * A spectator's Share on a watched board (Trevor, 2026-11-15): the share screen players
	 * have, with the room's join code and the script's link.
	 */
	interface Props {
		open: boolean;
		script: LoadedScript;
		logo?: string;
		room?: string;
	}

	let { open = $bindable(), script, logo, room }: Props = $props();
</script>

<ShareControl
	what="script"
	button={false}
	bind:open
	title={script.name}
	author={script.meta.author}
	version={scriptVersion(undefined, script.meta)}
	{logo}
	target={() => shareTargetFor(gameShareable(script), location.origin)}
	{room}
/>
