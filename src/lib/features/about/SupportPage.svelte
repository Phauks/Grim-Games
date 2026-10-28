<script lang="ts">
	import Page from '#lib/ui/layout/Page.svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import { KOFI_URL } from './support.ts';
</script>

<!-- Beneath About in the menu's App group (Trevor, 2026-10-26). -->
<Page title={t('shell.support')}>
	<p>{t('shell.supportIntro')}</p>
	<!-- Our own accent Button, not Ko-fi's button image (Trevor, 2026-10-28: "I liked the old Kofi button better").
	     In place but disabled until there is a link, so nothing moves when it arrives. -->
	{#if KOFI_URL}
		<Button variant="accent" icon="support" href={KOFI_URL}>{t('shell.supportKofi')}</Button>
	{:else}
		<Button variant="accent" icon="support" disabled>{t('shell.supportKofi')}</Button>
	{/if}
</Page>

<style>
	p {
		margin: var(--space-3) 0;
	}
</style>
