<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import GrimoirePage from '#lib/features/grimoire/GrimoirePage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Grimoire · {APP_NAME}</title>
</svelte:head>

{#key params.gameId}
	<GrimoirePage gameId={params.gameId} />
{/key}
