<script lang="ts">
	import type { SetupGamePort } from './game-port.ts';
	import BagSettings from './BagSettings.svelte';
	import JoinButton from './JoinButton.svelte';

	/** The title row's buttons, the same on Characters and Draw: bag settings, then join. */
	let { port }: { port: SetupGamePort } = $props();
</script>

<BagSettings />{#if port.openGame}<JoinButton game={port.openGame} />{/if}
