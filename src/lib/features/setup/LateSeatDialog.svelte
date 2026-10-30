<script lang="ts">
	/*
	 * Add late player (Trevor, 2026-10-30): someone arrives mid-draw, or after every tile is
	 * drawn but before the first night, and joins as one more player instead of a Traveller.
	 * Several can join at once, each at the spot tapped on the grimoire. Roll suggests who
	 * changes (the fair late seat, `proposeLateSeat`); the Storyteller can change any drawn
	 * player and anything in the bag before confirming, and the counts check warns, never locks.
	 * Before, After and Changes show the setup as it is, as it will be, and only what differs.
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
	import { TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ChangeList from '#lib/ui/primitives/ChangeList.svelte';
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Tabs from '#lib/ui/primitives/Tabs.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import CountsBar from './CountsBar.svelte';
	import type { LatePlayer } from './late-player.ts';

	interface Props {
		open: boolean;
		game: Game;
		/** The late players, each at the spot tapped on the grimoire. */
		players: LatePlayer[];
		/** Back to the grimoire to tap where another late player sits. */
		onAddAnother: () => void;
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
		scriptCharacters,
		official,
		lookup,
		send
	}: Props = $props();

	const KEEP = '';
	/** Rule characters the Storyteller invokes for this change (the Sentinel). */
	let rulesOn = $state<CharacterId[]>([]);
	let proposal = $state<LateSeatProposal | undefined>(undefined);
	/** Rolled rows first, then the Storyteller's own; each seat's chosen character. */
	let rows = $state<{ seatId: SeatId; rolled: boolean }[]>([]);
	let choice = $state<Record<SeatId, CharacterId>>({});
	/** The bag as the Storyteller edited it, over the roll's. */
	let edited = $state<CharacterId[] | undefined>(undefined);
	let tab = $state<'before' | 'after' | 'changes'>('after');

	// A roll is for a number of late players: another one means rolling again.
	const extra = $derived(players.length);
	$effect(() => {
		void extra;
		reset();
	});

	function reset() {
		proposal = undefined;
		rows = [];
		choice = {};
		edited = undefined;
	}

	const drawn = $derived(drawState(game, lookup));
	const dealt = $derived(drawn.seen.length + drawn.bag.length);
	const ruleCharacters = $derived([...game.ruleCharacters, ...rulesOn]);
	// A rule character not in play yet whose rules change the setup counts.
	const setupRules = $derived(
		official.filter(
			(c) =>
				(c.type === 'fabled' || c.type === 'loric') &&
				!game.ruleCharacters.includes(c.id) &&
				rulesOf(c.id)?.setupModifier?.ops.some((op) => op.kind === 'delta')
		)
	);
	const ruleLabel = (rule: Character) =>
		// eslint-disable-next-line grim/names-as-badges -- a switch's label is its text: "Sentinel: ±1 Outsider"
		`${rule.name}: ${rulesOf(rule.id)?.setupModifier?.summary ?? ''}`;

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
		rows = next.changes.map((c) => ({ seatId: c.seatId, rolled: true }));
		choice = Object.fromEntries(next.changes.map((c) => [c.seatId, c.to]));
	}

	const fromOf = (seatId: SeatId) => drawn.seen.find((s) => s.seatId === seatId)?.characterId;
	const bagNow = $derived(drawn.bag.map((t) => t.characterId));
	const bag = $derived(edited ?? proposal?.bag ?? bagNow);
	const changes = $derived(
		rows.flatMap(({ seatId }) => {
			const to = choice[seatId];
			const from = fromOf(seatId);
			return to && from && to !== from ? [{ seatId, from, to }] : [];
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
	const before = $derived(
		analyseSelection({
			players: dealt,
			selection: selectionOf(drawn.inPlay),
			ruleCharacters: game.ruleCharacters,
			scriptOrder,
			lookup
		})
	);
	const after = $derived(
		analyseSelection({
			players: dealt + extra,
			selection: selectionOf([...seatedAfter, ...bag, ...drawn.unseated]),
			ruleCharacters,
			scriptOrder,
			lookup
		})
	);
	const matches = $derived(
		SEATED_TYPES.every((type) => after.expected[type].includes(after.chosen[type]))
	);

	const taken = $derived(new Set([...seatedAfter, ...bag, ...drawn.unseated]));
	const dealable = $derived(
		scriptCharacters.filter((c) => SEATED_TYPES.includes(c.type as SeatedType))
	);
	/** Characters a changed player can become: on the script, a player's type, not in play. */
	function optionsFor(seatId: SeatId) {
		const from = fromOf(seatId);
		const keep = {
			value: KEEP,
			// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as badges (the option snippet)
			label: t('setup.late.keep', { name: lookup(from ?? '')?.name ?? '' })
		};
		return [
			keep,
			...dealable
				.filter((c) => c.id === choice[seatId] || !taken.has(c.id))
				.map((c) => ({ value: c.id, label: c.name, group: TYPE_PLURALS[c.type] }))
		];
	}
	const bagOptions = $derived(
		dealable
			.filter((c) => !taken.has(c.id))
			.map((c) => ({ value: c.id, label: c.name, group: TYPE_PLURALS[c.type] }))
	);

	const reasonOf = (seatId: SeatId, rolled: boolean) => {
		if (!rolled) return t('setup.late.yours');
		const from = fromOf(seatId);
		const type = from ? drawn.typeOf(from) : undefined;
		return type && proposal?.tileTarget[type] === 0
			? t('setup.late.none', { count: dealt + extra, type: TYPE_PLURALS[type] })
			: t('setup.late.rolled');
	};

	const others = $derived(
		drawn.seen
			.filter((s) => !rows.some((r) => r.seatId === s.seatId))
			.map((s) => ({
				value: s.seatId,
				// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as badges (the option snippet)
				label: `${seatName(game, s.seatId)}: ${lookup(s.characterId)?.name ?? s.characterId}`
			}))
	);

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

	/** Where a late player sits: the seats either side of the spot tapped. */
	function sidesOf(position: number): { a: SeatId; b: SeatId } | undefined {
		const seating = game.seating;
		if (seating.length === 0) return undefined;
		return {
			a: seating[(position - 1 + seating.length) % seating.length],
			b: seating[position % seating.length]
		};
	}

	function confirm() {
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
		open = false;
	}
</script>

<Dialog bind:open title={t('setup.late.title')} size="full">
	<div class="late" data-testid="late-seat">
		<section>
			<h3>{t('setup.late.who')}</h3>
			<ul class="players">
				{#each players as player, i (player.key)}
					<li data-testid="late-player-row">
						<TextField
							label={t('setup.reveal.name')}
							bind:value={player.name}
							placeholder={t('common.none')}
						/>
						<span class="muted where">{@render where(player.position)}</span>
						<DeleteButton
							label={t('setup.late.remove')}
							disabled={players.length === 1}
							onclick={() => (players = players.filter((_, j) => j !== i))}
						/>
					</li>
				{/each}
			</ul>
			<Button icon="latePlayer" onclick={onAddAnother} data-testid="late-add-another"
				>{t('setup.late.addAnother')}</Button
			>
		</section>

		<section>
			<h3>{t('setup.late.players', { from: dealt, to: dealt + extra })}</h3>
			{#each setupRules as rule (rule.id)}
				<SettingToggle
					label={ruleLabel(rule)}
					checked={rulesOn.includes(rule.id)}
					onChange={(on) => {
						rulesOn = on ? [...rulesOn, rule.id] : rulesOn.filter((id) => id !== rule.id);
						reset();
					}}
				/>
			{/each}
			<div class="roll">
				<Button icon="random" onclick={roll} data-testid="late-roll"
					>{proposal ? t('setup.late.rollAgain') : t('setup.late.roll')}</Button
				>
				<span class="muted">{t('setup.late.onlyYou')}</span>
			</div>
		</section>

		<Tabs
			bind:value={tab}
			steady
			tabs={[
				{ value: 'before', label: t('setup.late.before') },
				{ value: 'after', label: t('setup.late.after') },
				{ value: 'changes', label: t('setup.late.changes') }
			]}
		>
			{#snippet panel(value)}
				{#if value === 'before'}
					<div class="panel" data-testid="late-before">
						<CountsBar analysis={before} travellers={before.travellers} />
						<h3>{t('setup.late.inPlay')}</h3>
						<ul class="seats">
							{#each drawn.seen as s (s.seatId)}
								<li>
									<PlayerBadge name={seatName(game, s.seatId)} /><CharacterBadge
										characterId={s.characterId}
									/>
								</li>
							{/each}
						</ul>
						<h3>{t('setup.late.inBag')}</h3>
						<p class="badges">
							{#each bagNow as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{:else}{t(
									'common.none'
								)}{/each}
						</p>
					</div>
				{:else if value === 'after'}
					<div class="panel" data-testid="late-after">
						<CountsBar analysis={after} travellers={after.travellers} />
						<h3>{t('setup.late.change')}</h3>
						{#if rows.length === 0}
							<p class="muted" data-testid="late-no-changes">
								{proposal ? t('setup.late.noChanges') : t('common.none')}
							</p>
						{:else}
							<ul class="rows">
								{#each rows as row (row.seatId)}
									{@const from = fromOf(row.seatId)}
									<li data-testid="late-change">
										<div class="who">
											<PlayerBadge name={seatName(game, row.seatId)} />
											{#if from}<span class="muted">{t('setup.late.was')}</span>
												<CharacterBadge characterId={from} />{/if}
											<span class="muted reason">{reasonOf(row.seatId, row.rolled)}</span>
										</div>
										<Select
											label={t('setup.late.becomes')}
											hideLabel
											value={!choice[row.seatId] || choice[row.seatId] === from
												? KEEP
												: choice[row.seatId]}
											options={optionsFor(row.seatId)}
											onChange={(value) => (choice = { ...choice, [row.seatId]: value || from! })}
										>
											{#snippet item(option)}{@render pick(option, from)}{/snippet}
											{#snippet selected(option)}{@render pick(option, from)}{/snippet}
										</Select>
									</li>
								{/each}
							</ul>
						{/if}
						<Select
							label={t('setup.late.another')}
							hideLabel
							placeholder={t('setup.late.another')}
							options={others}
							disabled={others.length === 0}
							onChange={(seatId) => {
								if (seatId) rows = [...rows, { seatId, rolled: false }];
							}}
						>
							{#snippet item(option)}{@render seat(option)}{/snippet}
						</Select>
						<h3>{t('setup.late.inBag')}</h3>
						<ul class="bag-list" data-testid="late-bag">
							{#each bag as id, i (`${id}-${i}`)}
								{@const name = lookup(id)?.name ?? id}
								<li>
									<CharacterBadge characterId={id} /><DeleteButton
										label={t('setup.late.removeFromBag', { name })}
										onclick={() => (edited = bag.filter((_, j) => j !== i))}
									/>
								</li>
							{/each}
						</ul>
						<Select
							label={t('setup.late.addToBag')}
							hideLabel
							placeholder={t('setup.late.addToBag')}
							options={bagOptions}
							disabled={bagOptions.length === 0}
							onChange={(id) => {
								if (id) edited = [...bag, id];
							}}
						>
							{#snippet item(option)}{@render pick(option, undefined)}{/snippet}
						</Select>
					</div>
				{:else}
					<div class="panel" data-testid="late-changes">
						<ChangeList testid="late-change-list">
							{#each players as player (player.key)}
								<dt>{t('setup.late.joins')}</dt>
								<dd>
									{#if player.name.trim()}<PlayerBadge
											name={player.name.trim() as PlayerName}
										/>{:else}{t('setup.late.newSeat')}{/if}
									<span class="muted">{@render where(player.position)}</span>
								</dd>
							{/each}
							{#each changes as c (c.seatId)}
								<dt><PlayerBadge name={seatName(game, c.seatId)} /></dt>
								<dd>
									<CharacterBadge characterId={c.from} /><span aria-hidden="true">→</span
									><CharacterBadge characterId={c.to} />
								</dd>
							{/each}
							{#if bagIn.length}
								<dt>{t('setup.late.in')}</dt>
								<dd data-testid="late-bag-in">
									{#each bagIn as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{/each}
								</dd>
							{/if}
							{#if bagOut.length}
								<dt>{t('setup.late.out')}</dt>
								<dd data-testid="late-bag-out">
									{#each bagOut as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{/each}
								</dd>
							{/if}
							{#if outOfPlay.length}
								<dt>{t('setup.late.outOfPlay')}</dt>
								<dd data-testid="late-out-of-play">
									{#each outOfPlay as id, i (`${id}-${i}`)}<CharacterBadge
											characterId={id}
										/>{/each}
								</dd>
							{/if}
						</ChangeList>
						{#if !changes.length && !bagIn.length && !bagOut.length}
							<p class="muted">{t('setup.late.noneChanged')}</p>
						{/if}
					</div>
				{/if}
			{/snippet}
		</Tabs>

		<p class="check" class:matches data-testid="late-check">
			{matches
				? t('setup.late.matches', { count: dealt + extra })
				: t('setup.late.offCount', { count: dealt + extra })}
		</p>
	</div>
	{#snippet actions()}
		<ModalActions
			onCancel={() => (open = false)}
			onConfirm={confirm}
			confirmLabel={t('setup.late.confirm')}
		/>
	{/snippet}
</Dialog>

{#snippet where(position: number)}
	{@const sides = sidesOf(position)}
	{#if !sides}{t('setup.late.newSeat')}{:else if sides.a === sides.b}<Sentence
			text={t('setup.late.end', { a: slot('a') })}
		>
			{#snippet fill()}<PlayerBadge name={seatName(game, sides.a)} />{/snippet}
		</Sentence>{:else}<Sentence text={t('setup.late.where', { a: slot('a'), b: slot('b') })}>
			{#snippet fill(name)}<PlayerBadge
					name={seatName(game, name === 'a' ? sides.a : sides.b)}
				/>{/snippet}
		</Sentence>{/if}
{/snippet}

{#snippet pick(option: { value: string; label: string }, from: CharacterId | undefined)}
	<span class="option"
		>{#if option.value === KEEP && from}{t('setup.late.keepLabel')}<CharacterBadge
				characterId={from}
				interactive={false}
			/>{:else if option.value !== KEEP}<CharacterBadge
				characterId={option.value}
				interactive={false}
			/>{/if}</span
	>
{/snippet}

{#snippet seat(option: { value: string; label: string })}
	{@const from = fromOf(option.value as SeatId)}
	<span class="option"
		><PlayerBadge name={seatName(game, option.value as SeatId)} />{#if from}<CharacterBadge
				characterId={from}
				interactive={false}
			/>{/if}</span
	>
{/snippet}

<style>
	.late,
	.panel {
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
	.players li {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: end;
		gap: var(--space-1) var(--space-2);
		padding-bottom: var(--space-2);
	}
	.players .where {
		grid-row: 2;
		font-size: 0.875rem;
	}
	.roll {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.rows li {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border);
	}
	.who,
	.seats li,
	.bag-list li,
	.badges,
	.option {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.seats,
	.bag-list {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2) var(--space-3);
	}
	.reason {
		font-size: 0.875rem;
	}
	.check {
		padding: var(--space-2) var(--space-3);
		border-radius: var(--radius-md);
		background: var(--accent-wash);
	}
	.check.matches {
		background: var(--good-wash);
	}
</style>
