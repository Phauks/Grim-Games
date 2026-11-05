<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	// The Character Lab is the Character Analyzer (plans M45, M63); an old link, and its
	// #character, opens it there.
	onMount(() => {
		const to = resolve('/character-analyzer');
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolved above, plus the hash
		void goto(`${to}${location.hash}`, { replaceState: true });
	});
</script>

<svelte:head>
	<title>Character Analyzer · {APP_NAME}</title>
</svelte:head>
