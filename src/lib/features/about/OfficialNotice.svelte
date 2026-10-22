<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	/** The official game's site, linked from every notice that the app is not official. */
	const OFFICIAL_SITE = 'https://bloodontheclocktower.com';

	// The sentence around the game's name, which is drawn as the link.
	const MARK = '\u0000';
	const [before, after = ''] = $derived(t('shell.officialNotice', { game: MARK }).split(MARK));
</script>

<!--
	The one notice that the app is not an official Blood on the Clocktower product, wherever it
	appears (About, the privacy policy), with the game's name linking the official site
	(Trevor, 2026-10-20). The menu's Community Created Content logo links the same site's policy.
-->
<p class="official-notice">
	<!-- External site, not an app route. -->
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	{before}<a href={OFFICIAL_SITE} target="_blank" rel="noopener">{t('shell.officialGame')}</a
	>{after}
</p>

<style>
	p {
		margin: 0;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
	}
	a {
		color: inherit;
	}
</style>
