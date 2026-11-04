<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	// The Character Lab is part of the Characters page (plan M45); an old link opens it there.
	onMount(() => void goto(resolve('/reference'), { replaceState: true }));
</script>

<svelte:head>
	<title>Characters · {APP_NAME}</title>
</svelte:head>
