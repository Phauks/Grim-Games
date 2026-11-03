<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import CharacterLabPage from '#lib/features/character-lab/CharacterLabPage.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<svelte:head>
	<title>{`${t('lab.title')} · ${APP_NAME}`}</title>
</svelte:head>

<CharacterLabPage />
