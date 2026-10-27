<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { preferences } from '#lib/ui/preferences.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import PinDialog from '#lib/features/setup/PinDialog.svelte';
	import { drawLock } from '#lib/features/setup/draw-lock.svelte.ts';
	import CoverScreen, { type CoverDetails } from './CoverScreen.svelte';
	import ShowToPlayer from './ShowToPlayer.svelte';

	/**
	 * The grim cover, for the Storyteller only (Trevor, 2026-10-26): an opaque screen over
	 * the grimoire, on the board beside the day timer and in the day's header, never in a
	 * menu. It shows what isn't secret (the script's logo and name, the night or day, the
	 * timer), Back to town and the players' view (Trevor, 2026-10-27), and only its ✕ takes it
	 * away; with Settings > Storyteller > "PIN to take the
	 * cover off", that asks for the game's Storyteller PIN (draw-lock.svelte.ts), set the
	 * first time the screen is covered.
	 */
	interface Props {
		gameId: string;
		details?: CoverDetails;
		/** The day timer on the cover. */
		timer?: Snippet;
		/** Controls on the cover that show nothing secret (CoverScreen). */
		actions?: Snippet;
		outlined?: boolean;
	}

	let { gameId, details, timer, actions, outlined = false }: Props = $props();

	let open = $state(false);
	let setPinOpen = $state(false);
	let pinOpen = $state(false);
	/** The PIN asked to switch the lock off, not to take the cover off. */
	let lockPinOpen = $state(false);
	/** The PIN set from the cover's own lock, which then switches on. */
	let lockSetOpen = $state(false);
	const pinNeeded = $derived(preferences.current.coverPin);

	function cover() {
		if (pinNeeded && !drawLock.hasPin(gameId)) setPinOpen = true;
		else open = true;
	}

	/**
	 * The lock on the cover itself (Trevor, 2026-10-27: "I can't figure out how to toggle lock
	 * for grim cover"), the same setting as Settings > Storyteller's. Switching it on sets the
	 * game's PIN if it has none; switching it off takes the PIN, so a player can't.
	 */
	function toggleLock() {
		if (pinNeeded) {
			if (drawLock.hasPin(gameId)) lockPinOpen = true;
			else preferences.update({ coverPin: false });
		} else if (drawLock.hasPin(gameId)) preferences.update({ coverPin: true });
		else lockSetOpen = true;
	}
</script>

<IconButton
	icon="cover"
	label={t('show.cover')}
	data-testid="cover-button"
	{outlined}
	onclick={cover}
/>
<ShowToPlayer
	bind:open
	blank
	requestClose={pinNeeded && drawLock.hasPin(gameId) ? () => (pinOpen = true) : undefined}
>
	<span class="lock"
		><IconButton
			icon="lock"
			label={t('settings.coverPin')}
			aria-pressed={pinNeeded}
			data-testid="cover-lock"
			onclick={toggleLock}
		/></span
	>
	<CoverScreen {...details} {timer} {actions} />
	<PinDialog bind:open={pinOpen} {gameId} purpose="cover" onDone={() => (open = false)} />
	<PinDialog
		bind:open={lockPinOpen}
		{gameId}
		purpose="cover"
		onDone={() => preferences.update({ coverPin: false })}
	/>
	<PinDialog
		bind:open={lockSetOpen}
		{gameId}
		mode="set"
		purpose="cover"
		onDone={() => preferences.update({ coverPin: true })}
	/>
</ShowToPlayer>
<PinDialog
	bind:open={setPinOpen}
	{gameId}
	mode="set"
	purpose="cover"
	onDone={() => (open = true)}
/>

<style>
	/* Top left, across from ✕: on or off, the lock is the Storyteller's, as Settings' is. */
	.lock {
		position: absolute;
		top: calc(var(--space-2) + env(safe-area-inset-top));
		left: calc(var(--space-2) + env(safe-area-inset-left));
		z-index: 1;
		--icon-size: calc(1.5 * var(--u));
	}
	.lock :global(.icon-button) {
		background-color: var(--surface-raised);
	}
</style>
