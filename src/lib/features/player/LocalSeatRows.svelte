<script lang="ts">
	import type { CharacterId, LoadedScript } from '#lib/core/data/index.ts';
	import type { PublicSeat } from '#lib/core/sync/public-projection.ts';
	import {
		MAX_LOCAL_NAME_LENGTH,
		renameSeat,
		setDead,
		setTraveller,
		setVoteUsed,
		type LocalTown
	} from '#lib/core/town/local-town.ts';
	import { officialData } from '#lib/features/characters/game-data.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { localTown, saveLocalTown } from './local-town.svelte.ts';
	import { sheetCharacters } from './player-script.ts';

	/**
	 * A players-only game's seat (plan M55, Trevor 2026-11-05): what the town knows about it,
	 * marked by the player as the real Storyteller announces it, at the top of the seat's sheet.
	 */
	interface Props {
		notesKey: string;
		seat: PublicSeat;
		script: LoadedScript;
	}

	let { notesKey, seat, script }: Props = $props();

	function edit(change: (town: LocalTown) => LocalTown) {
		saveLocalTown(notesKey, change(localTown(notesKey)));
	}
	/** The name as typed, spaces and all, for its field. */
	const name = $derived(localTown(notesKey).seats.find((s) => s.id === seat.seatId)?.name ?? '');
	/** The script sheet's Travellers first, then every other one: a Traveller can join any game. */
	const travellers = $derived.by(() => {
		const data = officialData.current;
		const onSheet = (data ? sheetCharacters(script, data) : script.characters).filter(
			(c) => c.type === 'traveller'
		);
		const listed = new Set(onSheet.map((c) => c.id));
		const others = (data?.characters ?? []).filter(
			(c) => c.type === 'traveller' && !listed.has(c.id)
		);
		return [
			{ value: '', label: t('common.none') },
			...onSheet.map((c) => ({ value: c.id, label: c.name, group: t('player.grim.onTheScript') })),
			...others.map((c) => ({
				value: c.id,
				label: c.name,
				group: t('player.grim.otherTravellers')
			}))
		];
	});
</script>

<div class="local" data-testid="local-seat">
	<TextField
		label={t('player.grim.playerName')}
		value={name}
		maxlength={MAX_LOCAL_NAME_LENGTH}
		oninput={(typed) => edit((town) => renameSeat(town, seat.seatId, typed))}
		testid="local-seat-name"
	/>
	<Toggle
		label={t('player.grim.markDead')}
		checked={seat.dead}
		onChange={(dead) => edit((town) => setDead(town, seat.seatId, dead))}
	/>
	<!-- Only the dead have a ghost vote: in place but off while alive, so nothing moves. -->
	<Toggle
		label={t('player.grim.ghostVoteUsed')}
		checked={seat.ghostVote === 'used'}
		disabled={!seat.dead}
		onChange={(used) => edit((town) => setVoteUsed(town, seat.seatId, used))}
	/>
	<Select
		label={t('player.grim.travellerChoice')}
		value={seat.traveller ?? ''}
		options={travellers}
		onChange={(id) =>
			edit((town) => setTraveller(town, seat.seatId, (id as CharacterId) || undefined))}
		testid="local-seat-traveller"
	/>
</div>

<style>
	/* One line each, over the seat's guesses. */
	.local {
		display: grid;
		gap: var(--space-2);
		padding-bottom: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
</style>
