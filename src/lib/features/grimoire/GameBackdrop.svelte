<script lang="ts">
	import type { Game } from '#lib/core/model/index.ts';
	import type { PublicLook } from '#lib/core/sync/public-projection.ts';
	import { roomImagePath } from '#lib/core/sync/room-images.ts';
	import { backgroundFor, type BackgroundChoice } from './backgrounds.ts';
	import BoardBackdrop from './BoardBackdrop.svelte';
	import { boardBackground } from './board-background.svelte.ts';
	import { boardLooks } from './board-looks.svelte.ts';
	import { drawnLook, lookOf } from './shared-look.ts';

	/**
	 * The game's background on the board: the choice kept on this device for this game (or all
	 * games), the script's own image, or a preset, and the Board and tokens setting that changes it.
	 */
	interface Props {
		game: Game;
		/** The script's logo, offered as a background choice. */
		logo?: string;
		/**
		 * Someone else's board (Grim view, a finished grimoire): drawn on the look its
		 * Storyteller shared, never this device's own background (Trevor, 2026-10-26).
		 */
		watched?: { look?: PublicLook; room?: string };
		/** Told the look this board shows, and its picture, for every shared grim of the game. */
		onlook?: (look: PublicLook, picture?: Blob) => void;
	}

	let { game, logo, watched, onlook }: Props = $props();

	// ── Background: an image of the Storyteller's own, kept on this device ──
	let background = $state<BackgroundChoice>({ kind: 'none' });
	let backgroundRead = $state(0);
	/**
	 * Read again only when the game or the choice changes. Every command replaces `game`, so
	 * an effect reading `game.gameId` itself ran after each one (a ghost vote too) and made a
	 * new image link, and the image flashed while it loaded again (Trevor, 2026-10-23).
	 */
	const backgroundGameId = $derived(game.gameId);
	$effect(() => {
		void backgroundRead;
		const gameId = backgroundGameId;
		backgroundFor(gameId)
			.then((choice) => {
				if (backgroundGameId === gameId) background = choice;
			})
			.catch(() => (background = { kind: 'none' }));
	});
	/** The script's own background, only when it is a web link. */
	const scriptBackground = $derived(
		/^https:\/\//.test(game.script.meta?.background ?? '')
			? game.script.meta?.background
			: undefined
	);
	// Chosen in Board and tokens, for this game or all (Trevor, 2026-10-18).
	$effect(() =>
		boardBackground.set({
			get gameId() {
				return game.gameId;
			},
			get scriptImage() {
				return scriptBackground;
			},
			get scriptLogo() {
				return logo;
			},
			get scriptName() {
				return game.script.meta?.name;
			},
			get current() {
				return background;
			},
			onChange: () => (backgroundRead += 1)
		})
	);
	let backgroundUrl = $state<string | undefined>();
	$effect(() => {
		if (background.kind === 'image') {
			const url = URL.createObjectURL(background.image);
			backgroundUrl = url;
			return () => URL.revokeObjectURL(url);
		}
		backgroundUrl = background.kind === 'script' ? scriptBackground : undefined;
	});
	$effect(() => {
		if (!watched)
			onlook?.(
				lookOf(background, boardLooks.current),
				background.kind === 'image' ? background.image : undefined
			);
	});
	const shared = $derived(watched && drawnLook(watched.look));
</script>

{#if shared}
	<BoardBackdrop
		url={shared.image && watched?.room
			? roomImagePath(watched.room, shared.image)
			: shared.script
				? scriptBackground
				: undefined}
		preset={shared.preset}
		vignette={shared.vignette}
	/>
{:else}
	<BoardBackdrop
		url={backgroundUrl}
		preset={background.kind === 'preset' ? background.id : undefined}
		vignette={boardLooks.current.vignette ? boardLooks.current.vignetteStrength : undefined}
	/>
{/if}
