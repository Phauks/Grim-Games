<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import AboutPage from '#lib/features/about/AboutPage.svelte';
</script>

<svelte:head>
	<title>About · {APP_NAME}</title>
</svelte:head>

<AboutPage />
