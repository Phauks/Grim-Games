<script lang="ts">
	import JoinPage from '#lib/features/room/JoinPage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>Room · Grim-Games</title>
</svelte:head>

{#key params.code}
	<JoinPage code={params.code} />
{/key}
