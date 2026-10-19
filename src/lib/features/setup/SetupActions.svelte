<script lang="ts">
	import type { SetupGamePort } from './game-port.ts';
	import BagSettings from './BagSettings.svelte';
	import JoinButton from './JoinButton.svelte';

	/**
	 * The title row's buttons, the same on Characters and Draw: bag settings, then join.
	 * `disabled` while the draw is locked: they stay in place, so nothing moves.
	 */
	let { port, disabled = false }: { port: SetupGamePort; disabled?: boolean } = $props();
</script>

<BagSettings {disabled} />{#if port.openGame}<JoinButton game={port.openGame} {disabled} />{/if}
