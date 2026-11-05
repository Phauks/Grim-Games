<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
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
	<title>{t('reference.pageTitle')}</title>
</svelte:head>
