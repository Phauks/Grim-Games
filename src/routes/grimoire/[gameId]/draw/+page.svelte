<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import DrawPage from '#lib/features/setup/DrawPage.svelte';
	import WithGame from '#lib/features/setup/WithGame.svelte';
	import { noPhoneDraw } from '#lib/features/room/no-phone-draw.svelte.ts';
	import type { PageProps } from './$types';
	import type { GameId } from '#lib/core/model/index.ts';

	let { params }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('setup.pageTitle.draw')}</title>
</svelte:head>

{#key params.gameId}
	<!-- Open once set up too while players with no phone are still to see theirs here
	     (Trevor, 2026-11-01). -->
	<WithGame
		gameId={params.gameId}
		title={t('setup.draw')}
		inGame={noPhoneDraw.waiting(params.gameId as GameId).length > 0}
	>
		{#snippet children(port)}<DrawPage {port} />{/snippet}
	</WithGame>
{/key}
