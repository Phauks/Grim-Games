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
	 * timer) and only its ✕ takes it away; with Settings > Storyteller > "PIN to take the
	 * cover off", that asks for the game's Storyteller PIN (draw-lock.svelte.ts), set the
	 * first time the screen is covered.
	 */
	interface Props {
		gameId: string;
		details?: CoverDetails;
		/** The day timer on the cover. */
		timer?: Snippet;
		outlined?: boolean;
	}

	let { gameId, details, timer, outlined = false }: Props = $props();

	let open = $state(false);
	let setPinOpen = $state(false);
	let pinOpen = $state(false);
	const pinNeeded = $derived(preferences.current.coverPin);

	function cover() {
		if (pinNeeded && !drawLock.hasPin(gameId)) setPinOpen = true;
		else open = true;
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
	<CoverScreen {...details} {timer} />
	<PinDialog bind:open={pinOpen} {gameId} purpose="cover" onDone={() => (open = false)} />
</ShowToPlayer>
<PinDialog
	bind:open={setPinOpen}
	{gameId}
	mode="set"
	purpose="cover"
	onDone={() => (open = true)}
/>
