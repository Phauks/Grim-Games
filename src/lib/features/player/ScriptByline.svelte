<script lang="ts">
	import type { PublicStoryteller } from '#lib/core/sync/public-projection.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { bylineParts } from './byline.ts';
	import StorytellerProfile from './StorytellerProfile.svelte';

	/**
	 * Who wrote the script and which version it is (Trevor, 2026-10-17), and in a game who
	 * the Storyteller is. Each is left out when unknown; nothing shows when none is.
	 */
	interface Props {
		author?: string;
		version?: string;
		/** Who is running the game, when the script is a game's (Trevor, 2026-10-19). */
		storyteller?: string;
		/**
		 * The live room the game is in, and the look the Storyteller's board sends: their name
		 * then opens their profile, as Game info's does (Trevor, 2026-10-31).
		 */
		profile?: { roomCode: string; look?: PublicStoryteller };
		/** A span, for a line that is already a paragraph (a Page subtitle). */
		inline?: boolean;
	}

	let { author, version, storyteller, profile, inline = false }: Props = $props();
	const name = $derived(storyteller?.trim() || undefined);
	const parts = $derived(
		bylineParts({ author, version, storyteller: profile ? undefined : storyteller })
	);
	/** "Storyteller: {name}" around the name, so the name alone is the button. */
	const MARK = '\u0000';
	const around = $derived(t('player.storytellerIs', { name: MARK }).split(MARK));
	let profileOpen = $state(false);
</script>

{#if parts.length || (profile && name)}
	<svelte:element this={inline ? 'span' : 'p'} class="byline" data-testid="script-byline"
		>{parts.join(' · ')}{#if profile && name}{parts.length ? ' · ' : ''}{around[0]}<button
				type="button"
				class="storyteller"
				data-testid="byline-storyteller"
				onclick={() => (profileOpen = true)}>{name}</button
			>{around[1] ?? ''}{/if}</svelte:element
	>
{/if}
{#if profile && name}<StorytellerProfile
		bind:open={profileOpen}
		{name}
		look={profile.look}
		roomCode={profile.roomCode}
	/>{/if}

<style>
	p.byline {
		margin: 0 0 var(--space-3);
	}
	.byline {
		color: var(--on-surface-muted);
	}
	/* Reads as the line's text and opens the profile; the tap target is widened without
	   moving the line, as Game info's Storyteller is. */
	.storyteller {
		position: relative;
		min-height: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	.storyteller::before {
		content: '';
		position: absolute;
		inset: 50% auto auto 50%;
		min-width: max(100%, var(--tap-target));
		min-height: max(100%, var(--tap-target));
		transform: translate(-50%, -50%);
	}
</style>
