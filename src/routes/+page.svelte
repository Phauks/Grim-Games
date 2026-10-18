<script lang="ts">
	import { APP_NAME } from '#lib/core/app-name.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Page from '#lib/ui/layout/Page.svelte';
</script>

<!--
	Home is left blank until near 1.0 (Trevor, 2026-10-16): New game, Resume game and History
	are in the sidebar. It says so in Trevor's own words (2026-10-17). The title is for screen
	readers only; the header already shows the app's name.
-->
<Page title={APP_NAME} hideTitle>
	<p>{t('shell.homeBlank')}</p>
</Page>

<style>
	p {
		display: grid;
		place-items: center;
		min-height: 60dvh;
		margin: 0;
		color: var(--on-surface-muted);
		font-style: italic;
		text-align: center;
	}
</style>
