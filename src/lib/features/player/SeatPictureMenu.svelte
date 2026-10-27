<script lang="ts">
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import type { RoomPlayer } from '#lib/features/room/player.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Menu from '#lib/ui/primitives/Menu.svelte';

	/**
	 * The ⋯ on a seat's sheet in the player's Grim (Trevor, 2026-10-27: "clicking on a character
	 * in the game, and under ..., put report image"): reports the picture on that seat to the
	 * Storyteller, who lets it stand or takes it away for the game. Always there, so the header
	 * never moves; shown but not usable on a seat with no picture, this phone's own seat, or a
	 * picture it already reported, which the item then says (no success popup).
	 */
	interface Props {
		room: RoomPlayer;
		seat: PublicSeat;
	}

	let { room, seat }: Props = $props();

	const hash = $derived(room.view?.pictures?.[seat.seatId]);
	const reported = $derived(!!hash && room.reported.includes(hash));
	const own = $derived(room.view?.me.seatId === seat.seatId);
</script>

<Menu
	label={t('player.grim.seatMore')}
	items={[
		{
			value: 'report-picture',
			label: reported ? t('player.grim.pictureReported') : t('player.grim.reportPicture'),
			disabled: !hash || own || reported,
			onSelect: () => room.reportPicture(seat.seatId)
		}
	]}
/>
