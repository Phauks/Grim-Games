<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
</script>

<!--
	Home is left blank until near 1.0 (Trevor, 2026-10-16): New game, Resume game and History
	are in the sidebar. It says so in Trevor's own words (2026-10-17).
-->
<main>
	<!-- The page's name for screen readers; the header already shows it. -->
	<h1 class="visually-hidden">Grim-Games</h1>
	<p>{t('shell.homeBlank')}</p>
</main>

<style>
	main {
		display: grid;
		place-items: center;
		min-height: 60dvh;
	}
	p {
		margin: 0;
		color: var(--on-surface-muted);
		font-style: italic;
		text-align: center;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
