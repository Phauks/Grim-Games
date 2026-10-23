<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { openAdvancedNextTime } from '#lib/features/about/about-advanced.ts';

	// Deep link: /diagnostics opens the About page with Advanced open, where the diagnostics
	// live (2026-10-18; About became its own page 2026-10-23).
	onMount(() => {
		openAdvancedNextTime();
		void goto(resolve('/about'), { replaceState: true });
	});
</script>

<svelte:head>
	<title>Diagnostics · {APP_NAME}</title>
</svelte:head>
