<script lang="ts">
	import PageMenuButton from '#lib/features/shell/PageMenuButton.svelte';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import SeatSheetSpike from '#lib/features/spikes/SeatSheetSpike.svelte';
</script>

<svelte:head>
	<title>Seat sheet spike · {APP_NAME}</title>
</svelte:head>

<PageMenuButton />

<SeatSheetSpike />
