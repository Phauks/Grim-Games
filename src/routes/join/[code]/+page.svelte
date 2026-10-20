<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import PlayerView from '#lib/features/player/PlayerView.svelte';
	import type { PageProps } from './$types';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{`${t('room.pageTitle')} · ${APP_NAME}`}</title>
</svelte:head>

<!-- A room's link opens the player view on its Room tab (Trevor, 2026-10-19). -->
{#key params.code}
	<PlayerView join={{ code: params.code }} />
{/key}
