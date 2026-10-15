<script lang="ts">
	import favicon from '#lib/assets/favicon.svg';
	import '#lib/ui/base.css';
	import AppFooter from '#lib/features/about/AppFooter.svelte';
	import UpdateBanner from '#lib/features/about/UpdateBanner.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>Grim-Games</title>
</svelte:head>

{@render children()}

<AppFooter />
<UpdateBanner />
