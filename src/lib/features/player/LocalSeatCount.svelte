<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import {
		LOCAL_TOWN_MAX_SEATS,
		LOCAL_TOWN_MIN_SEATS,
		withSeatCount
	} from '#lib/core/town/local-town.ts';
	import { localTown, saveLocalTown } from './local-town.svelte.ts';

	/**
	 * A players-only game's seat count (plan M55), among the Grim tab's round buttons: seven to
	 * start, never None (Trevor, 2026-11-06).
	 */
	interface Props {
		notesKey: string;
		count: number;
		/** Among the town's buttons, its name is read out, not shown. */
		hideLabel?: boolean;
	}

	let { notesKey, count, hideLabel = false }: Props = $props();

	/** Every seat count a game can have. */
	const counts = Array.from(
		{ length: LOCAL_TOWN_MAX_SEATS - LOCAL_TOWN_MIN_SEATS + 1 },
		(_, i) => LOCAL_TOWN_MIN_SEATS + i
	);
</script>

<NumberSelect
	label={t('player.grim.seats')}
	{hideLabel}
	value={count}
	min={LOCAL_TOWN_MIN_SEATS}
	max={LOCAL_TOWN_MAX_SEATS}
	values={counts}
	format={(n) => t('player.local.seats', { count: n })}
	onchange={(n) => saveLocalTown(notesKey, withSeatCount(localTown(notesKey), n))}
	testid="local-seat-count"
/>
