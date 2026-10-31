<script lang="ts">
	/*
	 * Add late player (Trevor, 2026-10-30): someone arrives mid-draw, or after every tile is
	 * drawn but before the first night, and joins as one more player instead of a Traveller.
	 * Several can join at once, each at the spot tapped on the grimoire. Roll suggests who
	 * changes (the fair late seat, `proposeLateSeat`); the Storyteller can change any drawn
	 * player and anything in the bag before confirming, and the counts check warns, never locks.
	 * The characters are Character selection's own list (Trevor, 2026-10-31), its counts pinned
	 * at the top; Show only what is in play, Back to the draw as it was, and the changes alone
	 * in their own sheet.
	 */
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId, PlayerName } from '#lib/core/data/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import type { Command, TileSpec } from '#lib/core/engine/index.ts';
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import {
		analyseSelection,
		drawState,
		proposeLateSeat,
		SEATED_TYPES,
		type LateSeatProposal,
		type SeatedType
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ChangeList from '#lib/ui/primitives/ChangeList.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import IconButton from '#lib/ui/primitives/IconButton.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import CharacterChoice from '#lib/features/setup/CharacterChoice.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import AddCharactersDialog from '#lib/features/setup/AddCharactersDialog.svelte';
	import SelectionList from '#lib/features/setup/SelectionList.svelte';
	import PlayerCountSheet from '#lib/features/setup/PlayerCountSheet.svelte';
	import PlayerNameInput from '#lib/features/setup/PlayerNameInput.svelte';
	import type { LatePlayer } from './late-player.ts';

	interface Props {
		open: boolean;
		game: Game;
		/** The late players, each at the spot tapped on the grimoire once chosen. */
		players: LatePlayer[];
		/** Another late player, not placed yet. */
		onAddAnother: () => void;
		/** To the grimoire to tap where late player `index` sits. */
		onPlace: (index: number) => void;
		/** The script's characters, in script order. */
		scriptCharacters: readonly Character[];
		/** Every official character, for the rule characters that change setup. */
		official: readonly Character[];
		lookup: (id: CharacterId) => Character | undefined;
		send: (command: Command) => boolean;
	}

	let {
		open = $bindable(),
		game,
		players = $bindable(),
		onAddAnother,
		onPlace,
		scriptCharacters,
		official,
		lookup,
		send
	}: Props = $props();

	/** Rule characters the Storyteller invokes for this change (the Sentinel). */
	let rulesOn = $state<CharacterId[]>([]);
	/** Fabled and Loric in play that this change takes out (Trevor, 2026-10-31). */
	let rulesOff = $state<CharacterId[]>([]);
	let proposal = $state<LateSeatProposal | undefined>(undefined);
	/** Each changed seat's new character, from the roll or the Storyteller. */
	let choice = $state<Record<SeatId, CharacterId>>({});
	/** The bag as the Storyteller edited it, over the roll's. */
	let edited = $state<CharacterId[] | undefined>(undefined);
	let query = $state('');
	let inPlayOnly = $state(false);
	let changesOpen = $state(false);
	/** The player whose character is being changed. */
	let changing = $state<SeatId | undefined>(undefined);
	let adding = $state<'fabled' | 'loric' | undefined>(undefined);

	// A roll is for a number of late players: another one means rolling again.
	const extra = $derived(players.length);
	$effect(() => {
		void extra;
		reset();
	});

	function reset() {
		proposal = undefined;
		choice = {};
		edited = undefined;
	}
	/** Back to the draw as it was: no rule invoked, no player changed, the bag as it is. */
	function revert() {
		rulesOn = [];
		rulesOff = [];
		reset();
	}

	const drawn = $derived(drawState(game, lookup));
	const dealt = $derived(drawn.seen.length + drawn.bag.length);
	const ruleCharacters = $derived([
		...game.ruleCharacters.filter((id) => !rulesOff.includes(id)),
		...rulesOn
	]);
	// A rule character not in play yet whose rules change the setup counts.
	const setupRules = $derived(
		official.filter(
			(c) =>
				(c.type === 'fabled' || c.type === 'loric') &&
				!game.ruleCharacters.includes(c.id) &&
				rulesOf(c.id)?.setupModifier?.ops.some((op) => op.kind === 'delta')
		)
	);

	function roll() {
		const next = proposeLateSeat({
			game,
			scriptCharacters,
			lookup,
			ruleCharacters,
			random: Math.random,
			extra
		});
		proposal = next;
		edited = undefined;
		choice = Object.fromEntries(next.changes.map((c) => [c.seatId, c.to]));
	}

	const fromOf = (seatId: SeatId) => drawn.seen.find((s) => s.seatId === seatId)?.characterId;
	const bagNow = $derived(drawn.bag.map((t) => t.characterId));
	const bag = $derived(edited ?? proposal?.bag ?? bagNow);
	const changes = $derived(
		drawn.seen.flatMap(({ seatId, characterId: from }) => {
			const to = choice[seatId];
			return to && to !== from ? [{ seatId, from, to }] : [];
		})
	);
	const seatedAfter = $derived(
		drawn.seen.map((s) => changes.find((c) => c.seatId === s.seatId)?.to ?? s.characterId)
	);

	// The same counts Character selection shows, before and with the late players.
	const scriptOrder = $derived(scriptCharacters.map((c) => c.id));
	const selectionOf = (ids: readonly CharacterId[]) => {
		const selection: Record<CharacterId, number> = {};
		for (const id of ids) selection[id] = (selection[id] ?? 0) + 1;
		return selection;
	};
	const after = $derived(
		analyseSelection({
			players: dealt + extra,
			selection: selectionOf([...seatedAfter, ...bag, ...drawn.unseated]),
			ruleCharacters,
			scriptOrder,
			lookup
		})
	);

	const taken = $derived(new Set([...seatedAfter, ...bag, ...drawn.unseated]));
	const dealable = $derived(
		scriptCharacters.filter((c) => SEATED_TYPES.includes(c.type as SeatedType))
	);
	/** Characters a player can become: their own, or one on the script not in play. */
	const optionsFor = (seatId: SeatId) =>
		dealable.filter((c) => c.id === fromOf(seatId) || c.id === choice[seatId] || !taken.has(c.id));

	// The list: the script's characters, then the Fabled and Loric on it, in play or that
	// change setup, and any added from every Fabled or Loric there is.
	let rulesSeen = $state<CharacterId[]>([]);
	const ruleListed = $derived(
		[
			...new Set([
				...scriptCharacters
					.filter((c) => c.type === 'fabled' || c.type === 'loric')
					.map((c) => c.id),
				...game.ruleCharacters,
				...setupRules.map((c) => c.id),
				...rulesSeen
			])
		]
			.map((id) => lookup(id))
			.filter((c): c is Character => c !== undefined)
	);
	const selected = $derived([...taken, ...ruleCharacters]);
	const listed = $derived(
		[...dealable, ...ruleListed].filter((c) => !inPlayOnly || selected.includes(c.id))
	);
	const holderOf = (id: CharacterId) =>
		drawn.seen.find((s, i) => seatedAfter[i] === id && s !== undefined)?.seatId;
	/** Who has it, that it waits in the bag, or that this change takes it out of play. */
	function noteOf(character: Character): string | undefined {
		const seatId = holderOf(character.id);
		if (seatId) return seatName(game, seatId);
		if (bag.includes(character.id)) return t('latePlayer.inBagMark');
		return outOfPlay.includes(character.id) ? t('latePlayer.outOfPlay') : undefined;
	}
	function toggle(character: Character) {
		const id = character.id;
		if (character.type === 'fabled' || character.type === 'loric') {
			if (game.ruleCharacters.includes(id))
				rulesOff = rulesOff.includes(id) ? rulesOff.filter((r) => r !== id) : [...rulesOff, id];
			else rulesOn = rulesOn.includes(id) ? rulesOn.filter((r) => r !== id) : [...rulesOn, id];
			if (!rulesSeen.includes(id)) rulesSeen = [...rulesSeen, id];
			reset();
			return;
		}
		const i = bag.indexOf(id);
		if (i !== -1) {
			edited = bag.filter((_, j) => j !== i);
			return;
		}
		// A player's character: choose what they become.
		const seatId = holderOf(id);
		if (seatId) {
			changing = seatId;
			return;
		}
		if (!drawn.unseated.includes(id)) edited = [...bag, id];
	}
	/** Every Fabled or Loric there is, the script's first, for its Add dialog. */
	const allOf = (type: 'fabled' | 'loric') => [
		...scriptCharacters.filter((c) => c.type === type),
		...official.filter((c) => c.type === type && !scriptCharacters.includes(c))
	];
	const onScript = $derived(new Set(scriptCharacters.map((c) => c.id)));

	// What the bag gains and loses, against what is in it now.
	const minus = (a: readonly CharacterId[], b: readonly CharacterId[]) => {
		const left = [...b];
		return a.filter((id) => {
			const i = left.indexOf(id);
			if (i === -1) return true;
			left.splice(i, 1);
			return false;
		});
	};
	const bagOut = $derived(minus(bagNow, bag));
	const bagIn = $derived(minus(bag, bagNow));
	const outOfPlay = $derived(
		minus([...drawn.seen.map((s) => s.characterId), ...bagNow], [...seatedAfter, ...bag])
	);

	/** The player count's drop-down: more adds late players, fewer takes the last ones off. */
	function setCount(count: number) {
		const wanted = Math.max(1, count - dealt);
		const have = players.length;
		for (let n = have; n < wanted; n++) onAddAnother();
		if (have > wanted) players = players.slice(0, wanted);
	}

	/** Names on the seats and the other late players, so a phone is only offered once. */
	const takenBy = (index: number) => [
		...game.seating.flatMap((id) => game.seats[id].playerName ?? []),
		...players.flatMap((p, j) => (j !== index && p.name.trim() ? [p.name.trim()] : []))
	];

	/** Where a late player sits: the seats either side of the spot tapped. */
	function sidesOf(position: number | undefined): { a: SeatId; b: SeatId } | undefined {
		const seating = game.seating;
		if (seating.length === 0 || position === undefined) return undefined;
		return {
			a: seating[(position - 1 + seating.length) % seating.length],
			b: seating[position % seating.length]
		};
	}

	function confirm() {
		for (const id of rulesOff) if (!send({ type: 'RemoveRuleCharacter', characterId: id })) return;
		for (const id of rulesOn) if (!send({ type: 'AddRuleCharacter', characterId: id })) return;
		// A tile kept in the bag keeps what it shows (a Lunatic's tile shows a Demon).
		const left = drawn.bag.map((t) => game.bag!.tiles[t.tileId]);
		const specs: TileSpec[] = bag.map((id) => {
			const i = left.findIndex((tile) => tile.grimoire === id);
			if (i === -1) return { shows: id, grimoire: id };
			const [tile] = left.splice(i, 1);
			return { shows: tile.shows, grimoire: tile.grimoire, reminders: tile.reminders };
		});
		const ok = send({
			type: 'AddLatePlayer',
			players: players.map((p) => ({
				playerName: (p.name.trim() || undefined) as PlayerName | undefined,
				position: p.position
			})),
			changes: changes.map((c) => ({ seatId: c.seatId, characterId: c.to })),
			bag: specs
		});
		if (!ok) return;
		// Every phone gets its character again, so no one can tell who changed.
		if (roomHost().code) roomHost().showRoles(game.gameId, true);
		players = [];
		rulesOn = [];
		rulesOff = [];
		open = false;
	}
</script>

<Dialog bind:open title={t('latePlayer.title')} size="full" pinAside={false}>
	{#snippet aside()}
		<div class="late" data-testid="late-seat">
			<section>
				<h3>{t('latePlayer.who')}</h3>
				<ul class="players">
					{#each players as player, i (player.key)}
						<li data-testid="late-player-row">
							<div class="line">
								<PlayerNameInput
									bind:value={player.name}
									taken={takenBy(i)}
									hideLabel
									pickLabel={t('latePlayer.pickPhone')}
								/>
								<IconButton
									icon="grimoire"
									label={player.position === undefined
										? t('latePlayer.place')
										: t('latePlayer.move')}
									onclick={() => onPlace(i)}
									data-testid="late-place"
								/>
								<DeleteButton
									label={t('latePlayer.remove')}
									disabled={players.length === 1}
									onclick={() => (players = players.filter((_, j) => j !== i))}
								/>
							</div>
							<span class="muted where">{@render where(player.position)}</span>
						</li>
					{/each}
				</ul>
				<Button icon="latePlayer" onclick={onAddAnother} data-testid="late-add-another"
					>{t('latePlayer.addAnother')}</Button
				>
			</section>

			<!-- Character selection's own player count and setup sheet (Trevor, 2026-10-31): a
			     higher count adds late players, a lower one takes the last ones away. -->
			<PlayerCountSheet
				players={dealt + extra}
				min={dealt + 1}
				onChange={setCount}
				storageKey="late-player:sheet"
				testid="late-player-count"
			/>
		</div>
	{/snippet}
	<!-- Character selection's own list: tap to put a character in the bag or take it out, or
		     to change the player who has it (Trevor, 2026-10-30 and 2026-10-31). -->
	<div class="list" data-testid="late-after">
		<SelectionList
			analysis={after}
			travellers={after.travellers}
			characters={listed}
			{selected}
			bind:query
			collapsibleKey="late-player"
			surface="sheet"
			types={['townsfolk', 'outsider', 'minion', 'demon', 'fabled', 'loric']}
			closedTypes={['loric']}
			onSelect={(id) => {
				const character = lookup(id);
				if (character) toggle(character);
			}}
		>
			{#snippet tools()}
				<IconButton
					icon="random"
					label={proposal ? t('latePlayer.rollAgain') : t('latePlayer.roll')}
					onclick={roll}
					data-testid="late-roll"
				/>
				<IconButton
					icon="selectedOnly"
					label={t('latePlayer.inPlayOnly')}
					aria-pressed={inPlayOnly}
					onclick={() => (inPlayOnly = !inPlayOnly)}
				/>
				<IconButton
					icon="changes"
					label={t('latePlayer.showChanges')}
					onclick={() => (changesOpen = true)}
					data-testid="late-show-changes"
				/>
				<IconButton
					icon="reset"
					label={t('latePlayer.revert')}
					disabled={!proposal && !edited && !changes.length && !rulesOn.length && !rulesOff.length}
					onclick={revert}
					data-testid="late-revert"
				/>
			{/snippet}
			{#snippet groupAside(type)}
				{#if type === 'fabled' || type === 'loric'}
					<IconButton
						icon="add"
						label={t(type === 'fabled' ? 'setup.addFabled' : 'setup.addLoric')}
						onclick={() => (adding = type)}
					/>
				{/if}
			{/snippet}
			{#snippet item(character, state)}
				<CharacterChoice
					{character}
					copies={state.selected ? 1 : 0}
					duplicates={false}
					note={noteOf(character)}
					onToggle={() => toggle(character)}
					onAddCopy={() => {}}
				/>
			{/snippet}
		</SelectionList>
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={confirm}
			confirmLabel={t('latePlayer.confirm')}
		/>
	{/snippet}
</Dialog>

<!-- Only what differs, before and after (Trevor, 2026-10-30). -->
<Dialog bind:open={changesOpen} title={t('latePlayer.changes')}>
	<div data-testid="late-changes">
		<ChangeList testid="late-change-list">
			{#each players as player (player.key)}
				<dt>{t('latePlayer.joins')}</dt>
				<dd>
					{#if player.name.trim()}<PlayerBadge name={player.name.trim() as PlayerName} />{:else}{t(
							'latePlayer.newSeat'
						)}{/if}
					<span class="muted">{@render where(player.position)}</span>
				</dd>
			{/each}
			{#each changes as c (c.seatId)}
				<dt><PlayerBadge name={seatName(game, c.seatId)} /></dt>
				<dd>
					<CharacterBadge characterId={c.from} /><span aria-hidden="true">→</span><CharacterBadge
						characterId={c.to}
					/>
				</dd>
			{/each}
			{#if rulesOn.length}
				<dt>{t('latePlayer.invoked')}</dt>
				<dd>
					{#each rulesOn as id (id)}<CharacterBadge characterId={id} />{/each}
				</dd>
			{/if}
			{#if rulesOff.length}
				<dt>{t('latePlayer.takenOut')}</dt>
				<dd>
					{#each rulesOff as id (id)}<CharacterBadge characterId={id} />{/each}
				</dd>
			{/if}
			{#if bagIn.length}
				<dt>{t('latePlayer.in')}</dt>
				<dd data-testid="late-bag-in">
					{#each bagIn as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{/each}
				</dd>
			{/if}
			{#if bagOut.length}
				<dt>{t('latePlayer.out')}</dt>
				<dd data-testid="late-bag-out">
					{#each bagOut as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{/each}
				</dd>
			{/if}
			{#if outOfPlay.length}
				<dt>{t('latePlayer.outOfPlay')}</dt>
				<dd data-testid="late-out-of-play">
					{#each outOfPlay as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{/each}
				</dd>
			{/if}
		</ChangeList>
		{#if !changes.length && !bagIn.length && !bagOut.length}
			<p class="muted">{t('latePlayer.noneChanged')}</p>
		{/if}
	</div>
</Dialog>

<!-- What a player becomes: Character selection's list again, one choice. -->
<Dialog
	bind:open={() => changing !== undefined, (o) => (changing = o ? changing : undefined)}
	title={t('latePlayer.changeTitle')}
	size="full"
>
	{#if changing}
		{@const seatId = changing}
		<div class="change" data-testid="late-change">
			<p class="badges">
				<PlayerBadge name={seatName(game, seatId)} /><span class="muted">{t('latePlayer.was')}</span
				><CharacterBadge characterId={fromOf(seatId) ?? ''} />
			</p>
			<CharacterPicker
				characters={optionsFor(seatId)}
				selected={[choice[seatId] ?? fromOf(seatId) ?? '']}
				collapsibleKey="late-change"
				types={['townsfolk', 'outsider', 'minion', 'demon']}
				onSelect={(id) => {
					choice = { ...choice, [seatId]: id };
					changing = undefined;
				}}
			/>
		</div>
	{/if}
</Dialog>

{#if adding}
	{@const type = adding}
	<AddCharactersDialog
		bind:open={() => adding === type, (o) => (adding = o ? type : undefined)}
		title={t(type === 'fabled' ? 'setup.allFabled' : 'setup.allLoric')}
		{type}
		characters={allOf(type)}
		{selected}
		marker={(c) => (onScript.has(c.id) ? undefined : t('setup.offScript'))}
		onToggle={(id) => {
			const character = lookup(id);
			if (character) toggle(character);
		}}
	/>
{/if}

{#snippet where(position: number | undefined)}
	{@const sides = sidesOf(position)}
	{#if !sides}{t('latePlayer.notPlaced')}{:else if sides.a === sides.b}<Sentence
			text={t('latePlayer.end', { a: slot('a') })}
		>
			{#snippet fill()}<PlayerBadge name={seatName(game, sides.a)} />{/snippet}
		</Sentence>{:else}<Sentence text={t('latePlayer.where', { a: slot('a'), b: slot('b') })}>
			{#snippet fill(name)}<PlayerBadge
					name={seatName(game, name === 'a' ? sides.a : sides.b)}
				/>{/snippet}
		</Sentence>{/if}
{/snippet}

<style>
	.late,
	.change {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: 1rem;
	}
	.muted {
		color: var(--on-surface-muted);
	}
	p {
		margin: 0;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* One line per late player: the name with its phones button, then Choose seat and remove. */
	.players li {
		display: grid;
		gap: var(--space-1);
		padding-block: var(--space-2);
		border-bottom: 1px solid var(--border);
	}
	.players .line {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-2);
	}
	.players .where {
		font-size: 0.875rem;
	}
	.badges {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
</style>
