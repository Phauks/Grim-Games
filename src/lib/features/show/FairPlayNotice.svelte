<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	interface Props {
		/**
		 * What the reader is asked to keep fair: `secret` for something only they may see
		 * (their character, info sent to their phone), `message` for what a player sends the
		 * Storyteller, `watch` for a spectator's promise before Grim view.
		 */
		kind: 'secret' | 'message' | 'watch';
	}

	let { kind }: Props = $props();
</script>

<!--
	The one fair-play warning (Trevor, 2026-10-27: "all such warnings should be part of a
	central component"): wherever information could be misused to spoil the game, this says
	it's a no-no, in Trevor's own words. It never blocks anything: a web page can't stop a
	screenshot, so it asks rather than enforces. Always rendered beside what it guards, so
	showing or hiding that moves nothing.
-->
{#if kind === 'watch'}
	<div class="watch" data-testid="fair-play">
		<p>{t('show.fairPlay.watchLead')}</p>
		<ul data-testid="watch-pledge">
			<li>{t('show.fairPlay.watchCheat')}</li>
			<li>{t('show.fairPlay.watchShare')}</li>
			<li>{t('show.fairPlay.watchIntegrity')}</li>
		</ul>
	</div>
{:else}
	<p class="line" data-testid="fair-play">
		{kind === 'secret' ? t('show.fairPlay.secret') : t('show.fairPlay.message')}
	</p>
{/if}

<style>
	p {
		margin: 0;
	}
	.line {
		max-width: 28rem;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
		text-align: center;
	}
	ul {
		margin: var(--space-2) 0 0;
		padding-left: 1.25em;
	}
</style>
