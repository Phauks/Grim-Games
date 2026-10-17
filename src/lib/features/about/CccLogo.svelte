<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<!--
	The Pandemonium Institute asks projects that use official assets to show a Community
	Created Content logo (release.botc.app/resources, "Community Created Content logos"). Its
	policy only asks that it is shown clearly on the work, not where
	(bloodontheclocktower.com/pages/community-created-content-policy), so it sits at the bottom
	of the menu rather than in every page's footer (Trevor, 2026-10-17).
	static/brand/ccc-parchment.webp is resources/community/ccc-parchment.png from
	ThePandemoniumInstitute/botc-release @ f10cd02, resized to 360px wide.
-->
<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
<a
	class="ccc"
	href="https://bloodontheclocktower.com/pages/community-created-content-policy"
	target="_blank"
	rel="noopener"
>
	<img src="/brand/ccc-parchment.webp" width="120" height="45" alt={t('shell.cccAlt')} />
</a>

<style>
	.ccc {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: var(--tap-target);
		padding: var(--space-2) var(--space-3);
		opacity: 0.8;
	}
	img {
		display: block;
		width: calc(7.5 * var(--u));
		height: auto;
	}
</style>
