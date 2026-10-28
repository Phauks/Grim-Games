<script lang="ts">
	import Page from '#lib/ui/layout/Page.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import KofiButton from './KofiButton.svelte';
</script>

<!-- Beneath About in the menu's App group (Trevor, 2026-10-26). -->
<Page title={t('shell.support')}>
	<p>{t('shell.supportIntro')}</p>
	<KofiButton />
</Page>

<style>
	p {
		margin: var(--space-3) 0;
	}
</style>
