<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId, PlayerName } from '#lib/core/data/index.ts';
	import { fromScript } from '#lib/core/data/index.ts';
	import type { Command } from '#lib/core/engine/index.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { moreTravellers, recommendedTravellers } from '#lib/core/rules/index.ts';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterRow from '#lib/features/characters/CharacterRow.svelte';
	import { loadOfficialData, officialData } from '#lib/features/characters/game-data.svelte.ts';
	import type { OpenGame } from '#lib/features/game/session.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import { roomHost } from './host.svelte.ts';
	import { playersDialog } from './players-dialog.svelte.ts';

	/**
	 * Travellers choose on their phones (Trevor, 2026-10-31), on the Storyteller's device: send
	 * the choice to some seats with the Travellers allowed (the recommended ones, any, or ones
	 * picked here), then watch who holds and who has confirmed. A confirmed Traveller goes on its
	 * seat (host-traveller-pick.ts). It opens from Add seat with the new seat ticked (Trevor,
	 * 2026-11-01), and from the sheet of a seat still choosing. A seat that already has a
	 * character (a Traveller included) is shown but can't be sent the choice. The alignment is
	 * left for later, where every Traveller's is chosen: the night's Traveller alignment step or
	 * the seat (Trevor, 2026-11-01; https://wiki.bloodontheclocktower.com/Glossary, "Traveller").
	 * Seats with no phone are picked for here.
	 */
	let { game, run }: { game: OpenGame; run?: (command: Command) => boolean } = $props();

	const host = roomHost();
	const pick = $derived(host.travellerPick);

	$effect(() => void loadOfficialData());
	const data = $derived(officialData.current);
	const script = $derived(data ? fromScript(game.game.script, data).script : undefined);
	const recommended = $derived(
		data && script ? recommendedTravellers(script.characters, script.edition, data.characters) : []
	);
	const others = $derived(data ? moreTravellers(recommended, data.characters) : []);
	const byId = $derived(new Map([...recommended, ...others].map((c) => [c.id, c] as const)));

	type Allowed = 'recommended' | 'any' | 'chosen';
	let allowed = $state<Allowed>('recommended');
	let chosen = $state<CharacterId[]>([]);
	let seats = $state<SeatId[]>([]);
	/** The send form, also over an open choice to change it. */
	let editing = $state(false);
	const sending = $derived(!pick || editing);

	const options = $derived(
		allowed === 'any'
			? [...recommended, ...others].map((c) => c.id)
			: allowed === 'chosen'
				? chosen
				: recommended.map((c) => c.id)
	);
	const seatName = (seatId: SeatId) =>
		game.game.seats[seatId]?.playerName ??
		t('common.seat', { number: game.game.seating.indexOf(seatId) + 1 });
	const hasPhone = (seatId: SeatId) => host.members.some((m) => m.seatId === seatId);
	/** Has a character token already (Trevor, 2026-11-01), unless it's in the open choice. */
	const taken = (seatId: SeatId) =>
		!!game.game.seats[seatId]?.characterId && !pick?.seats.some((s) => s.seatId === seatId);

	/**
	 * The seat Add seat just placed (Trevor, 2026-11-02: "when adding a character, give a pop-up
	 * to add as a traveler"): its Traveller is picked here on this device, or the choice goes to
	 * the phones and runs in the background while the Storyteller carries on.
	 */
	let newSeat = $state<SeatId>();
	let onPhones = $state(true);
	const toPhones = $derived(!!host.code && onPhones);
	/** Picked here: the Travellers the Selection allows, to tap one. */
	const here = $derived(
		(allowed === 'recommended' ? recommended : [...recommended, ...others]).filter(
			(c) => !game.game.seating.some((id) => game.game.seats[id]?.characterId === c.id)
		)
	);
	function pickHere(character: Character) {
		const command: Command = {
			type: 'AssignCharacter',
			seatId: newSeat!,
			characterId: character.id
		};
		if (run ? run(command) : game.run(command).ok) close();
	}
	function close() {
		playersDialog.travellers = false;
		newSeat = undefined;
	}

	function send() {
		host.send({
			type: 'open-traveller-pick',
			gameId: game.game.gameId,
			pickId: crypto.randomUUID(),
			options,
			seats: seats.filter((seatId) => !taken(seatId))
		});
		editing = false;
		// The phones choose in the background; the seat's token opens the list again.
		close();
	}
	function change() {
		if (pick) seats = pick.seats.map((s) => s.seatId);
		editing = true;
	}
	// Opened from Add seat: the new seat is ticked, or joins the choice already open.
	$effect(() => {
		const seatId = playersDialog.travellerSeat;
		if (!playersDialog.travellers || seatId === undefined) return;
		untrack(() => {
			if (pick) change();
			else seats = [];
			if (!seats.includes(seatId)) seats = [...seats, seatId];
			newSeat = seatId;
			playersDialog.travellerSeat = undefined;
		});
	});
	function stop() {
		host.send({ type: 'close-traveller-pick' });
		playersDialog.travellers = false;
	}

	/** The seat being picked for (a player without a phone, or any seat). */
	let pickingFor = $state<SeatId>();
	const pickable = $derived.by(() => {
		if (!pick || !pickingFor) return [];
		const held = new Set(
			pick.seats.filter((s) => s.seatId !== pickingFor && s.characterId).map((s) => s.characterId)
		);
		return pick.options.flatMap((id) => {
			const character = byId.get(id);
			return character && !held.has(id) ? [character] : [];
		});
	});
	function pickFor(character: Character) {
		if (!pickingFor) return;
		host.send({ type: 'traveller-for', seatId: pickingFor, characterId: character.id });
		pickingFor = undefined;
	}
</script>

<Dialog
	bind:open={() => playersDialog.travellers, (open) => (open ? undefined : close())}
	title={t(newSeat ? 'room.travellers.addAs' : 'room.travellers.title')}
>
	{#if sending}
		<div class="form" data-testid="traveller-pick-send">
			{#if newSeat}
				<!-- Here or on the phones, on this screen (Trevor, 2026-11-02); phones need a room. -->
				<Toggle
					label={t('room.travellers.toPhones')}
					checked={toPhones}
					disabled={!host.code}
					onChange={(on) => (onPhones = on)}
				/>
			{/if}
			<Select
				label={t('room.travellers.allowed')}
				value={toPhones || allowed !== 'chosen' ? allowed : 'any'}
				options={[
					{ value: 'any', label: t('room.travellers.any') },
					{ value: 'recommended', label: t('room.travellers.recommended') },
					...(toPhones ? [{ value: 'chosen' as const, label: t('room.travellers.chosen') }] : [])
				]}
				onChange={(value) => (allowed = value)}
			/>
			{#if !toPhones}
				<ul class="rows" data-testid="traveller-pick-here">
					{#each here as character (character.id)}
						<li><CharacterRow {character} info onclick={() => pickHere(character)} /></li>
					{:else}
						<li class="row">{t('common.none')}</li>
					{/each}
				</ul>
			{:else if allowed === 'recommended'}
				<!-- Recommended shows those; Custom the whole list to pick from (Trevor, 2026-11-01). -->
				<ul class="rows" data-testid="traveller-pick-recommended">
					{#each recommended as character (character.id)}
						<li><CharacterRow {character} info /></li>
					{:else}
						<li class="row">{t('common.none')}</li>
					{/each}
				</ul>
			{:else if allowed === 'chosen'}
				<CharacterPicker
					characters={[...recommended, ...others]}
					mode="multi"
					selected={chosen}
					showSearch={false}
					onSelect={(id) =>
						(chosen = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id])}
				/>
			{/if}
			{#if toPhones}
				<h3 class="heading">{t('room.travellers.who')}</h3>
				<ul class="rows">
					{#each game.game.seating as seatId (seatId)}
						<li class="row">
							<Toggle
								label={seatName(seatId)}
								checked={seats.includes(seatId)}
								disabled={taken(seatId)}
								onChange={(on) =>
									(seats = on ? [...seats, seatId] : seats.filter((s) => s !== seatId))}
							/>
							<span class="tag"
								>{t(hasPhone(seatId) ? 'room.travellers.phone' : 'room.travellers.noPhone')}</span
							>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if pick}
		<ul class="rows" data-testid="traveller-pick-status">
			{#each pick.seats as seat (seat.seatId)}
				{@const character = seat.characterId ? byId.get(seat.characterId) : undefined}
				<li class="row status">
					<PlayerBadge name={seatName(seat.seatId) as PlayerName} />
					<span class="state">
						{#if character}<CharacterBadge characterId={character.id} {character} />
							{t(seat.confirmed ? 'room.travellers.confirmed' : 'room.travellers.holding')}
						{:else}{t('room.travellers.choosing')}{/if}
					</span>
					<span class="tools">
						{#if seat.characterId}
							<Button
								variant="quiet"
								onclick={() =>
									host.send({ type: 'traveller-for', seatId: seat.seatId, characterId: null })}
								>{t('room.travellers.release')}</Button
							>
						{:else}
							<Button variant="quiet" onclick={() => (pickingFor = seat.seatId)}
								>{t('room.travellers.pick')}</Button
							>
						{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#snippet actions()}
		{#if sending && !toPhones}
			<Button variant="quiet" onclick={close}>{t('room.travellers.notTraveller')}</Button>
		{:else if sending}
			<ModalActions
				onCancel={() => (pick && !newSeat ? (editing = false) : close())}
				onConfirm={send}
				disabled={options.length === 0 || !seats.some((seatId) => !taken(seatId))}
				confirmLabel={t('room.travellers.send')}
			/>
		{:else}
			<Button variant="quiet" onclick={change}>{t('room.travellers.change')}</Button>
			<Button variant="quiet" onclick={stop}>{t('room.travellers.stop')}</Button>
		{/if}
	{/snippet}
</Dialog>

<Dialog
	bind:open={() => pickingFor !== undefined, (open) => !open && (pickingFor = undefined)}
	title={t('room.travellers.pickFor', { player: pickingFor ? seatName(pickingFor) : '' })}
>
	<ul class="rows">
		{#each pickable as character (character.id)}
			<li><CharacterRow {character} info onclick={() => pickFor(character)} /></li>
		{/each}
	</ul>
</Dialog>

<style>
	.form {
		display: grid;
		gap: var(--space-3);
	}
	.heading {
		margin: 0;
		font-size: 1rem;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
	}
	.row {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding-block: var(--space-1);
		border-bottom: 1px solid var(--color-divider); /* px-ok: hairline divider */
	}
	.row > :global([data-scope='switch'][data-part='root']) {
		flex: 1;
	}
	.status {
		flex-wrap: wrap;
	}
	.status > :global(:first-child) {
		flex: none;
	}
	.status .state {
		flex: 1 1 auto;
		white-space: nowrap;
		color: var(--color-text-muted);
	}
	.tools {
		margin-left: auto;
		display: flex;
		gap: var(--space-2);
		align-items: center;
	}
	.tag {
		color: var(--color-text-muted);
		font-size: 0.85rem;
	}
</style>
