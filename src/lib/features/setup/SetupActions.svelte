<script lang="ts">
	import type { SetupGamePort } from './game-port.ts';
	import BagSettings from './BagSettings.svelte';
	import JoinButton from './JoinButton.svelte';
	import ScriptCharactersButton from './ScriptCharactersButton.svelte';

	/**
	 * The title row's buttons, the same on Characters and Draw: bag settings, the script's own
	 * characters in the bag, then join.
	 */
	let { port }: { port: SetupGamePort } = $props();
</script>

<BagSettings /><ScriptCharactersButton {port} />{#if port.openGame}<JoinButton
		game={port.openGame}
	/>{/if}
