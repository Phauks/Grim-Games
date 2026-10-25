<script lang="ts">
	import type { SetupGamePort } from './game-port.ts';
	import BagSettings from './BagSettings.svelte';
	import JoinButton from './JoinButton.svelte';
	import ScriptCharactersButton from './ScriptCharactersButton.svelte';

	/**
	 * The title row's buttons, the same on Characters and Draw: bag settings (one cog, with All
	 * settings inside, Trevor 2026-10-24), the script's own characters in the bag, and join.
	 */
	let { port }: { port: SetupGamePort } = $props();
</script>

<BagSettings /><ScriptCharactersButton {port} />{#if port.openGame}<JoinButton
		game={port.openGame}
	/>{/if}
