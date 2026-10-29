<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import Popover from '#lib/ui/primitives/Popover.svelte';

	interface Props {
		/**
		 * What the reader is asked to keep fair: `secret` for something only they may see
		 * (their character, info sent to their phone), `message` for what a player sends the
		 * Storyteller, `watch` for a spectator's promise before Grim view, `profile` for the
		 * look on a player's seat, which the whole table sees (Trevor, 2026-10-29).
		 */
		kind: 'secret' | 'message' | 'watch' | 'profile';
		/**
		 * One short line with a caret that opens the whole warning, as Game info's corner name
		 * does (Grim view while watching, Trevor 2026-10-28: "Too verbose").
		 */
		short?: boolean;
	}

	let { kind, short = false }: Props = $props();
	let open = $state(false);
	let anchor = $state<HTMLElement>();
	const text = $derived(
		kind === 'secret'
			? t('show.fairPlay.secret')
			: kind === 'profile'
				? t('show.fairPlay.profile')
				: t('show.fairPlay.message')
	);
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
{:else if short}
	<button
		type="button"
		class="short"
		bind:this={anchor}
		aria-haspopup="dialog"
		aria-expanded={open}
		data-testid="fair-play"
		onclick={() => (open = true)}>{t('show.fairPlay.short')}<Icon name="expand" /></button
	>
	<Popover bind:open title={t('show.fairPlay.title')} {anchor}>
		<p class="full" data-testid="fair-play-full">{text}</p>
	</Popover>
{:else}
	<p class="line" data-testid="fair-play">{text}</p>
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
	/* Small text with a caret, as the corner's script name; the ::before keeps the tap target. */
	.short {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.2em;
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: var(--on-surface-muted);
		font: inherit;
		font-size: 0.85rem;
		text-shadow: inherit;
		pointer-events: auto;
		cursor: pointer;
		--icon-size: 0.9em;
	}
	.short::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: max(100%, var(--tap-target));
		min-height: max(100%, var(--tap-target));
		transform: translate(-50%, -50%);
	}
	.full {
		max-width: 22rem;
	}
	ul {
		margin: var(--space-2) 0 0;
		padding-left: 1.25em;
	}
</style>
