<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import DaySpike from '#lib/features/spikes/day/DaySpike.svelte';
</script>

<svelte:head>
	<title>Day spike · {APP_NAME}</title>
</svelte:head>

<DaySpike />
