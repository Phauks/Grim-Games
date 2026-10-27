<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';

	interface Props {
		/**
		 * What the player is asked to keep fair: `secret` for something only they may see
		 * (their character, info sent to their phone), `message` for what they send the
		 * Storyteller.
		 */
		kind: 'secret' | 'message';
	}

	let { kind }: Props = $props();
</script>

<!--
	The one fair-play notice (Trevor, 2026-10-27): wherever information on a player's phone
	could be misused, the player is told it's a no-no. It never blocks anything: a web page
	can't stop a screenshot, so this asks rather than enforces. Always rendered, so showing
	or hiding what it sits beside moves nothing.
-->
<p class="fair-play" data-testid="fair-play">
	<strong>{t('show.fairPlay.label')}</strong>
	{kind === 'secret' ? t('show.fairPlay.secret') : t('show.fairPlay.message')}
</p>

<style>
	p {
		max-width: 28rem;
		margin: 0;
		font-size: 0.85rem;
		color: var(--on-surface-muted);
		text-align: center;
	}
	strong {
		color: var(--on-surface);
	}
</style>
