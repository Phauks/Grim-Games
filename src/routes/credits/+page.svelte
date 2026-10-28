<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import CreditsPage from '#lib/features/about/CreditsPage.svelte';
</script>

<svelte:head>
	<title>Credits · {APP_NAME}</title>
</svelte:head>

<CreditsPage />
