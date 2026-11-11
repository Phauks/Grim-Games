<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import {
		seatingFromSetup,
		type SeatingFrom
	} from '#lib/features/grimoire/seats/seating-mode.svelte.ts';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import type { SetupGamePort } from './game-port.ts';
	import BagSettings from './BagSettings.svelte';
	import JoinButton from './JoinButton.svelte';

	/**
	 * The title row's buttons, the same on Characters and Draw: bag settings (one cog, with All
	 * settings and the script's own characters inside, Trevor 2026-10-24 and 10-26), join, and
	 * Arrange seats (Trevor, 2026-10-31 on Characters; 2026-11-06 on the draw too), which opens
	 * the board in Seating and whose Done comes back to this screen.
	 */
	interface Props {
		port: SetupGamePort;
		/** The screen these are on, which Seating's Done comes back to. */
		from: SeatingFrom;
		/** Arrange seats can't be used yet. */
		seatingDisabled?: boolean;
		/** Readies the seats before Seating opens; false stops it. */
		beforeSeating?: () => boolean;
	}

	let { port, from, seatingDisabled = false, beforeSeating }: Props = $props();

	async function seating() {
		const game = port.game;
		if (!game || beforeSeating?.() === false) return;
		await port.flush();
		await seatingFromSetup(game.gameId, from);
	}
</script>

<BagSettings {port} />{#if port.openGame}<JoinButton game={port.openGame} />{/if}<IconButton
	icon="arrange"
	label={t('room.seating.title')}
	disabled={seatingDisabled || !port.game}
	onclick={seating}
/>
