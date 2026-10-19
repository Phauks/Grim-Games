<script lang="ts">
	import type { Character, GameData } from '#lib/core/data/index.ts';
	import type { Game, SeatId } from '#lib/core/model/index.ts';
	import { seatNumber } from '#lib/core/model/index.ts';
	import type { DayStep, GameMode } from '#lib/core/modes/index.ts';
	import type { VoteTally } from '#lib/core/sync/room.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { reportError } from '#lib/features/errors/report.svelte.ts';
	import { roomHost } from '#lib/features/room/host.svelte.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import BottomSheet from '#lib/ui/primitives/BottomSheet.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import ModeValue from './ModeValue.svelte';
	import { readSpecterAbility, writeSpecterAbility, type SpecterAbility } from './specters.ts';

	/**
	 * The spectators' shared ability of a mode like Specters
	 * (https://www.youtube.com/watch?v=-R34QbIgDh8), in a sheet over the board so the
	 * grimoire stays in reach (Trevor, 2026-10-18). The Storyteller sets the ability (a
	 * character's ability or their own text), opens a vote on the players, watches the count
	 * and decides: how votes are counted isn't published, so every most-voted player is shown.
	 * Spectators are phones in the room without a seat; the board keeps the room attached.
	 */
	interface Props {
		open: boolean;
		game: Game;
		mode: GameMode;
	}

	let { open = $bindable(), game, mode }: Props = $props();

	const step = $derived(
		mode.parts.daySteps?.find(
			(s): s is Extract<DayStep, { kind: 'spectator-vote' }> => s.kind === 'spectator-vote'
		)
	);

	let data = $state.raw<GameData>();
	$effect(() => {
		if (!open || data) return;
		loadOfficialData()
			.then((d) => (data = d))
			.catch((e) => reportError(e, { area: 'grimoire' }));
	});

	// Unset: the mode's own ability (the Wizard's).
	let saved = $state.raw<SpecterAbility | undefined>();
	$effect.pre(() => {
		saved = readSpecterAbility(game.gameId);
	});
	const ability = $derived<SpecterAbility>(
		saved ??
			(step?.grants?.[0]
				? { kind: 'character', characterId: step.grants[0] }
				: { kind: 'custom', text: '' })
	);
	function setAbility(next: SpecterAbility) {
		saved = next;
		writeSpecterAbility(game.gameId, next);
	}
	const character = $derived<Character | undefined>(
		ability.kind === 'character' ? data?.byId.get(ability.characterId) : undefined
	);
	let customText = $state('');
	$effect.pre(() => {
		if (ability.kind === 'custom') customText = ability.text;
	});
	/** What the spectators read on their vote. */
	/* eslint-disable grim/names-as-badges -- plain text sent to the spectators' phones */
	const abilityText = $derived(
		ability.kind === 'character'
			? character
				? `${character.name}: ${character.ability}`
				: ''
			: ability.text.trim()
	);
	/* eslint-enable grim/names-as-badges */
	let picking = $state(false);

	const host = roomHost();
	const seats = $derived(game.seating);
	const spectators = $derived(host.members.filter((m) => m.seatId === undefined).length);

	// The last count stays shown after the vote closes, so the Storyteller can act on it.
	let last = $state.raw<VoteTally | undefined>();
	$effect(() => {
		if (host.vote) last = host.vote;
	});
	const shown = $derived(host.vote ?? last);
	const most = $derived.by(() => {
		if (!shown || shown.voted === 0) return new Set<SeatId>();
		const top = Math.max(...shown.options.map((o) => shown.counts[o] ?? 0));
		return new Set(shown.options.filter((o) => (shown.counts[o] ?? 0) === top));
	});

	function label(seatId: SeatId): string {
		const number = t('common.seat', { number: seatNumber(game, seatId) ?? 0 });
		const name = game.seats[seatId]?.playerName;
		return name ? `${number} · ${name}` : number;
	}

	function openVote() {
		last = undefined;
		host.openVote([...seats], abilityText || undefined);
	}
</script>

<BottomSheet
	bind:open
	title={step?.ability ?? t('modes.specters.menu')}
	height="85dvh"
	focusFirstField={false}
>
	<div class="sheet" data-testid="specters-sheet">
		<section class="group" aria-labelledby="specters-ability-title">
			<h3 id="specters-ability-title">{t('modes.specters.ability')}</h3>
			<Select
				label={t('modes.specters.abilityKind')}
				value={ability.kind}
				options={[
					{ value: 'character', label: t('modes.specters.abilityCharacter') },
					{ value: 'custom', label: t('modes.specters.abilityCustom') }
				]}
				onChange={(kind) =>
					setAbility(
						kind === 'character'
							? { kind, characterId: step?.grants?.[0] ?? 'wizard' }
							: { kind, text: customText }
					)}
			/>
			{#if ability.kind === 'character'}
				<div class="character">
					<CharacterBadge characterId={ability.characterId} />
					<Button icon="rename" disabled={!data} onclick={() => (picking = true)}>
						{t('modes.specters.pickCharacter')}
					</Button>
				</div>
				<p data-testid="specters-ability">{character?.ability ?? ''}</p>
			{:else}
				<TextField
					label={t('modes.specters.abilityText')}
					bind:value={customText}
					multiline
					maxlength={500}
					oninput={(text) => setAbility({ kind: 'custom', text })}
					testid="specters-custom"
				/>
			{/if}
			<dl class="facts">
				<dt>{t('modes.field.when')}</dt>
				<dd><ModeValue field="when" value={step?.when ?? 'each-dawn'} /></dd>
				<dt>{t('modes.field.lasts')}</dt>
				<dd><ModeValue field="lasts" value={step?.lasts ?? 'until-next-dawn'} /></dd>
			</dl>
		</section>

		<section class="group" aria-labelledby="specters-vote-title">
			<h3 id="specters-vote-title">{t('modes.specters.vote')}</h3>
			<!-- Every row and button is always drawn, so a vote opening or closing moves nothing. -->
			<p class="muted" data-testid="specters-room">
				{host.code
					? t('modes.specters.spectators', { voted: shown?.voted ?? 0, count: spectators })
					: t('modes.specters.noRoom')}
			</p>
			<div class="buttons">
				<Button
					variant="accent"
					icon="vote"
					disabled={!host.code || host.status !== 'open' || seats.length === 0}
					onclick={openVote}
				>
					{host.vote ? t('modes.specters.reopen') : t('modes.specters.open')}
				</Button>
				<Button icon="close" disabled={!host.vote} onclick={() => host.closeVote()}>
					{t('modes.specters.close')}
				</Button>
			</div>
			<ol class="tally" data-testid="specters-tally">
				{#each seats as seatId (seatId)}
					<li data-most={most.has(seatId) || undefined}>
						<span>{label(seatId)}</span>
						<span class="count">{shown?.counts[seatId] ?? 0}</span>
					</li>
				{/each}
			</ol>
		</section>
	</div>
</BottomSheet>

<Dialog bind:open={picking} title={t('modes.specters.pickCharacter')} size="full">
	<CharacterPicker
		characters={data?.characters ?? []}
		onSelect={(characterId) => {
			setAbility({ kind: 'character', characterId });
			picking = false;
		}}
	/>
</Dialog>

<style>
	.sheet {
		display: grid;
		gap: var(--space-4);
	}
	.group {
		display: grid;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		padding-bottom: var(--space-1);
		border-bottom: 2px solid var(--border);
		font-size: 1.05rem;
	}
	p,
	dl {
		margin: 0;
	}
	.character {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.facts {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-2) var(--space-3);
		align-items: center;
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
	}
	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.tally {
		display: grid;
		gap: var(--space-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.tally li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2);
		min-height: var(--tap-target);
		padding: 0 var(--space-3);
		border: var(--card-border);
		border-radius: var(--radius-sm);
	}
	.tally li[data-most] {
		border-color: var(--accent);
		background: var(--surface-selected);
	}
	.count {
		font-variant-numeric: tabular-nums;
	}
	.muted {
		color: var(--on-surface-muted);
	}
</style>
