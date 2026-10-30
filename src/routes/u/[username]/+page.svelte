<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import ProfilePage from '#lib/features/friends/ProfilePage.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{`${params.username} · ${APP_NAME}`}</title>
</svelte:head>

<!-- Anyone's profile and the scripts they publish (plan F10), signed in or not. -->
{#key params.username}
	<ProfilePage username={params.username} />
{/key}
