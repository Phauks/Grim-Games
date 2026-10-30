<script lang="ts">
	/*
	 * Add late player (Trevor, 2026-10-30): someone arrives mid-draw, or after every tile is
	 * drawn but before the first night, and joins as one more player instead of a Traveller.
	 * Roll suggests who changes (the fair late seat, `proposeLateSeat`); the Storyteller can
	 * change, keep or add anyone before confirming, and the counts check warns, never locks.
	 */
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId, PlayerName } from '#lib/core/data/index.ts';
	import { rulesOf } from '#lib/core/data/rules/index.ts';
	import type { Command, TileSpec } from '#lib/core/engine/index.ts';
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import {
		drawState,
		lateSeatCounts,
		proposeLateSeat,
		SEATED_TYPES,
		type LateSeatProposal,
		type SeatedType
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import { seatName } from '#lib/features/game/seat-label.ts';
	import { TYPE_LABELS, TYPE_PLURALS } from '#lib/features/reference/labels.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';

	interface Props {
		open: boolean;
		game: Game;
		/** The script's characters, in script order. */
		scriptCharacters: readonly Character[];
		/** Every official character, for the rule characters that change setup. */
		official: readonly Character[];
		lookup: (id: CharacterId) => Character | undefined;
		send: (command: Command) => boolean;
	}

	let { open = $bindable(), game, scriptCharacters, official, lookup, send }: Props = $props();

	const KEEP = '';
	let name = $state('');
	/** Rule characters the Storyteller invokes for this change (the Sentinel). */
	let rulesOn = $state<CharacterId[]>([]);
	let proposal = $state<LateSeatProposal | undefined>(undefined);
	/** Rolled rows first, then the Storyteller's own; each seat's chosen character. */
	let rows = $state<{ seatId: SeatId; rolled: boolean }[]>([]);
	let choice = $state<Record<SeatId, CharacterId>>({});

	$effect(() => {
		if (!open) return;
		name = '';
		rulesOn = [];
		reset();
	});

	function reset() {
		proposal = undefined;
		rows = [];
		choice = {};
	}

	const drawn = $derived(drawState(game, lookup));
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
	const input = (random: () => number) => ({
		game,
		scriptCharacters,
		lookup,
		ruleCharacters,
		random
	});
	// The counts before a roll: the same as a roll's, which only breaks ties at random.
	const preview = $derived(proposal ?? proposeLateSeat(input(() => 0)));
	const players = $derived(drawn.seen.length + drawn.bag.length);

	function roll() {
		const next = proposeLateSeat(input(Math.random));
		proposal = next;
		rows = next.changes.map((c) => ({ seatId: c.seatId, rolled: true }));
		choice = Object.fromEntries(next.changes.map((c) => [c.seatId, c.to]));
	}

	const fromOf = (seatId: SeatId) => drawn.seen.find((s) => s.seatId === seatId)?.characterId;
	const bag = $derived(proposal?.bag ?? drawn.bag.map((t) => t.characterId));
	const changes = $derived(
		rows.flatMap(({ seatId }) => {
			const to = choice[seatId];
			return to && to !== fromOf(seatId) ? [{ seatId, to }] : [];
		})
	);
	const counts = $derived(lateSeatCounts(game, lookup, changes, bag));
	const matches = $derived(SEATED_TYPES.every((type) => counts[type] === preview.tileTarget[type]));

	/** Characters a changed player can become: on the script, a player's type, not in play. */
	function optionsFor(seatId: SeatId) {
		const from = fromOf(seatId);
		const taken = new Set([
			...drawn.seen.map((s) => choice[s.seatId] ?? s.characterId),
			...bag,
			...drawn.unseated
		]);
		const keep = {
			value: KEEP,
			// eslint-disable-next-line grim/names-as-badges -- the option's accessible name and typeahead text; it shows as badges (the option snippet)
			label: t('setup.late.keep', { name: lookup(from ?? '')?.name ?? '' })
		};
		return [
			keep,
			...scriptCharacters
				.filter((c) => SEATED_TYPES.includes(c.type as SeatedType))
				.filter((c) => c.id === choice[seatId] || !taken.has(c.id))
				.map((c) => ({
					value: c.id,
					label: c.name,
					group: TYPE_PLURALS[c.type]
				}))
		];
	}

	const reasonOf = (seatId: SeatId, rolled: boolean) => {
		if (!rolled) return t('setup.late.yours');
		const from = fromOf(seatId);
		const type = from ? drawn.typeOf(from) : undefined;
		return type && preview.tileTarget[type] === 0
			? t('setup.late.none', { count: players + 1, type: TYPE_PLURALS[type] })
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
	const bagNow = $derived(drawn.bag.map((t) => t.characterId));
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
	const outOfPlay = $derived([
		...bagOut.filter((id) => !rows.some((r) => choice[r.seatId] === id)),
		...changes.map((c) => fromOf(c.seatId)!).filter((id) => !bag.includes(id))
	]);

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
		const playerName = name.trim() as PlayerName;
		const ok = send({
			type: 'AddLatePlayer',
			playerName: playerName || undefined,
			changes: changes.map((c) => ({ seatId: c.seatId, characterId: c.to })),
			bag: specs
		});
		if (!ok) return;
		// Every phone gets its character again, so no one can tell who changed.
		if (roomHost().code) roomHost().showRoles(game.gameId, true);
		open = false;
	}
</script>

<Dialog bind:open title={t('setup.late.title')} size="full">
	<div class="late" data-testid="late-seat">
		<TextField label={t('setup.reveal.name')} bind:value={name} placeholder={t('common.none')} />

		<section>
			<h3>{t('setup.late.players', { from: players, to: players + 1 })}</h3>
			<ul class="counts" data-testid="late-counts">
				{#each SEATED_TYPES as type (type)}
					{@const now = drawn.inPlay.filter((id) => drawn.typeOf(id) === type).length}
					<li class:evil={type === 'minion' || type === 'demon'}>
						<span class="value"
							>{now === preview.after[type] ? now : `${now} → ${preview.after[type]}`}</span
						>
						<span class="label">{type === 'demon' ? TYPE_LABELS.demon : TYPE_PLURALS[type]}</span>
					</li>
				{/each}
			</ul>
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
		</section>

		<section>
			<div class="roll">
				<Button icon="random" onclick={roll} data-testid="late-roll"
					>{proposal ? t('setup.late.rollAgain') : t('setup.late.roll')}</Button
				>
				<span class="muted">{t('setup.late.onlyYou')}</span>
			</div>
		</section>

		<section>
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
		</section>

		<section>
			<h3>{t('setup.late.bag')}</h3>
			<dl class="bag">
				<dt>{t('setup.late.in')}</dt>
				<dd data-testid="late-bag-in">
					{#each bagIn as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{:else}{t(
							'common.none'
						)}{/each}
				</dd>
				<dt>{t('setup.late.out')}</dt>
				<dd data-testid="late-bag-out">
					{#each bagOut as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{:else}{t(
							'common.none'
						)}{/each}
				</dd>
				<dt>{t('setup.late.outOfPlay')}</dt>
				<dd data-testid="late-out-of-play">
					{#each outOfPlay as id, i (`${id}-${i}`)}<CharacterBadge characterId={id} />{:else}{t(
							'common.none'
						)}{/each}
				</dd>
			</dl>
		</section>

		<p class="check" class:matches data-testid="late-check">
			{#if matches}
				{t('setup.late.matches', { count: players + 1 })}
			{:else}
				{t('setup.late.offCount', {
					count: players + 1,
					counts: SEATED_TYPES.map((type) => `${counts[type]} ${TYPE_LABELS[type]}`).join(', ')
				})}
			{/if}
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
	.late {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
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
	.counts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: var(--space-2);
	}
	.counts li {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: var(--space-2);
		border-radius: var(--radius-md);
		background: var(--surface-raised);
		border-top: 0.25rem solid var(--good);
	}
	.counts li.evil {
		border-top-color: var(--evil);
	}
	.counts .value {
		font-weight: bold;
		font-size: 1.125rem;
	}
	.counts .label {
		font-size: 0.8125rem;
	}
	.roll {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		flex-wrap: wrap;
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rows li {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-2) 0;
		border-bottom: 1px solid var(--border);
	}
	.who {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.reason {
		font-size: 0.875rem;
	}
	.bag {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-3);
		margin: 0;
	}
	.bag dt {
		color: var(--on-surface-muted);
	}
	.bag dd {
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-1);
	}
	.option {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
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
