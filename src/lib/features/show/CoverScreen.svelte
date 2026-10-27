<script lang="ts" module>
	/** What the grim cover may show: nothing from the grimoire, only what everyone knows. */
	export interface CoverDetails {
		/** The script's logo (scriptLogo), when it has one. */
		logo?: string;
		name?: string;
		author?: string;
		/** The night or day in play, such as "Day 2". */
		phase?: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScriptLogo from '#lib/features/scripts/ScriptLogo.svelte';

	/**
	 * What the grim cover shows (Trevor, 2026-10-26: "It should show the timer, along with
	 * other non secret information such as the script logo"): the script's logo, name and
	 * author, the night or day, and the day timer. Never anything from the grimoire.
	 */
	interface Props extends CoverDetails {
		/** The day timer, as the screen that opened the cover shows it. */
		timer?: Snippet;
	}

	let { logo, name, author, phase, timer }: Props = $props();
</script>

<div class="cover" data-testid="cover-details">
	{#if logo}<ScriptLogo src={logo} {name} class="cover-logo" />{/if}
	{#if name}<h2 class="name">{name}</h2>{/if}
	{#if author}<p class="author">{t('show.byAuthor', { author })}</p>{/if}
	{#if phase}<p class="phase" data-testid="cover-phase">{phase}</p>{/if}
	{#if timer}<div class="timer">{@render timer()}</div>{/if}
</div>

<style>
	.cover {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--space-2);
		height: 100%;
		padding: calc(var(--tap-target) + var(--space-4) + env(safe-area-inset-top)) var(--space-4)
			calc(var(--space-4) + env(safe-area-inset-bottom));
		text-align: center;
	}
	.cover :global(.cover-logo) {
		display: block;
		width: min(80%, calc(24 * var(--u)));
		height: 35dvh;
		flex: none;
	}
	.cover :global(.cover-logo img) {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.name {
		margin: 0;
		font-family: var(--font-heading);
		font-size: 1.8rem;
		color: var(--on-surface);
	}
	.author,
	.phase {
		margin: 0;
		color: var(--on-surface-muted);
	}
	.phase {
		font-size: 1.2rem;
		font-weight: 600;
	}
	/* Big enough to read across the table. */
	.timer {
		margin-top: var(--space-4);
		font-size: 2rem;
	}
</style>
