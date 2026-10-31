<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Alignment, Character, CharacterId, PlayerName } from '#lib/core/data/index.ts';
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
	 * seat (host-traveller-pick.ts); the alignment is chosen here or on the board
	 * (https://wiki.bloodontheclocktower.com/Glossary, "Traveller"). Seats with no phone are
	 * picked for here.
	 */
	let { game, run }: { game: OpenGame; run?: (command: Command) => boolean } = $props();

	const host = roomHost();
	const pick = $derived(host.travellerPick);
	const exec = (command: Command) => (run ? run(command) : game.game && game.run(command).ok);

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

	function send() {
		host.send({
			type: 'open-traveller-pick',
			gameId: game.game.gameId,
			pickId: crypto.randomUUID(),
			options,
			seats
		});
		editing = false;
	}
	function change() {
		if (pick) seats = pick.seats.map((s) => s.seatId);
		editing = true;
	}
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
	const ALIGNMENTS: Alignment[] = ['good', 'evil'];
</script>

<Dialog bind:open={playersDialog.travellers} title={t('room.travellers.title')}>
	{#if sending}
		<div class="form" data-testid="traveller-pick-send">
			<Select
				label={t('room.travellers.allowed')}
				value={allowed}
				options={[
					{ value: 'recommended', label: t('room.travellers.recommended') },
					{ value: 'any', label: t('room.travellers.any') },
					{ value: 'chosen', label: t('room.travellers.chosen') }
				]}
				onChange={(value) => (allowed = value)}
			/>
			{#if allowed === 'chosen'}
				<CharacterPicker
					characters={[...recommended, ...others]}
					mode="multi"
					selected={chosen}
					showSearch={false}
					onSelect={(id) =>
						(chosen = chosen.includes(id) ? chosen.filter((c) => c !== id) : [...chosen, id])}
				/>
			{/if}
			<h3 class="heading">{t('room.travellers.who')}</h3>
			<ul class="rows">
				{#each game.game.seating as seatId (seatId)}
					<li class="row">
						<Toggle
							label={seatName(seatId)}
							checked={seats.includes(seatId)}
							onChange={(on) =>
								(seats = on ? [...seats, seatId] : seats.filter((s) => s !== seatId))}
						/>
						<span class="tag"
							>{t(hasPhone(seatId) ? 'room.travellers.phone' : 'room.travellers.noPhone')}</span
						>
					</li>
				{/each}
			</ul>
		</div>
	{:else if pick}
		<ul class="rows" data-testid="traveller-pick-status">
			{#each pick.seats as seat (seat.seatId)}
				{@const character = seat.characterId ? byId.get(seat.characterId) : undefined}
				{@const alignment = game.game.seats[seat.seatId]?.alignment}
				<li class="row status">
					<PlayerBadge name={seatName(seat.seatId) as PlayerName} />
					<span class="state">
						{#if character}<CharacterBadge characterId={character.id} {character} />
							{t(seat.confirmed ? 'room.travellers.confirmed' : 'room.travellers.holding')}
						{:else}{t('room.travellers.choosing')}{/if}
					</span>
					<span class="tools">
						{#if seat.confirmed}
							<Select
								label={t('room.travellers.alignment')}
								hideLabel
								placeholder={t('room.travellers.alignment')}
								value={alignment}
								options={ALIGNMENTS.map((a) => ({ value: a, label: t(`characters.${a}`) }))}
								onChange={(value) =>
									exec({ type: 'SetAlignment', seatId: seat.seatId, alignment: value })}
							/>
						{/if}
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
		{#if sending}
			<ModalActions
				onCancel={() => (pick ? (editing = false) : (playersDialog.travellers = false))}
				onConfirm={send}
				disabled={options.length === 0 || seats.length === 0}
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
