<script lang="ts">
	import { fromScript, scriptLogo } from '#lib/core/data/index.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import ShareControl from '#lib/features/scripts/ShareControl.svelte';
	import { gameShareable } from '#lib/features/scripts/game-shareable.svelte.ts';
	import { shareTargetFor } from '#lib/features/scripts/share-codes.ts';
	import { scriptVersion } from '#lib/features/player/player-script.ts';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * A spectator's Share on a watched board (Trevor, 2026-11-15): the share screen players
	 * have, with the room's join code and the script's link. Nothing until the script loads.
	 */
	interface Props {
		open: boolean;
		grimoire: Grimoire;
	}

	let { open = $bindable(), grimoire }: Props = $props();
	const script = $derived(
		officialData.current ? fromScript(grimoire.game.script, officialData.current).script : undefined
	);
</script>

{#if script}<ShareControl
		what="script"
		button={false}
		bind:open
		title={script.name}
		author={script.meta.author}
		version={scriptVersion(undefined, script.meta)}
		logo={scriptLogo(script) || undefined}
		target={() => shareTargetFor(gameShareable(script), location.origin)}
		room={grimoire.room}
	/>{/if}
