<script lang="ts">
	import PageMenuButton from '#lib/features/shell/PageMenuButton.svelte';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import LiveScanSpike from '#lib/features/spikes/live-scan/LiveScanSpike.svelte';
</script>

<svelte:head>
	<title>Live scan spike · {APP_NAME}</title>
</svelte:head>

<PageMenuButton />

<LiveScanSpike />
