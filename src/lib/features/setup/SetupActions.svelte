<script lang="ts">
	import type { SetupGamePort } from './game-port.ts';
	import BagSettings from './BagSettings.svelte';
	import JoinButton from './JoinButton.svelte';

	/**
	 * The title row's buttons, the same on Characters and Draw: bag settings (one cog, with All
	 * settings and the script's own characters inside, Trevor 2026-10-24 and 10-26), and join.
	 */
	let { port }: { port: SetupGamePort } = $props();
</script>

<BagSettings {port} />{#if port.openGame}<JoinButton game={port.openGame} />{/if}
