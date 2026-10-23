<script lang="ts">
	import PageMenuButton from '#lib/features/shell/PageMenuButton.svelte';
	import { APP_NAME } from '#lib/core/app-name.ts';
	import DaySpike from '#lib/features/spikes/day/DaySpike.svelte';
</script>

<svelte:head>
	<title>Day spike · {APP_NAME}</title>
</svelte:head>

<PageMenuButton />

<DaySpike />
