<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { WISH_EFFECTS, type SeatId, type WishEffect } from '#lib/core/model/index.ts';
	import { grantedWish } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Records a wish (a character's `wish` rule: the Wizard's), opened from its day row: what
	 * they wished for, granted or declined, the price and the clue in the Storyteller's words,
	 * and a standard effect the app acts on (every good player drunk). Today's wish of theirs
	 * opens to be changed; an earlier one stays in the log. Nothing is refused: a second
	 * granted wish only says so.
	 */
	let { game }: { game: DayPort } = $props();

	let open = $state(false);
	let seatId = $state<SeatId>();
	let characterId = $state<CharacterId>();
	let text = $state('');
	let granted = $state<'granted' | 'declined'>('granted');
	let price = $state('');
	let clue = $state('');
	let effect = $state<WishEffect | 'none'>('none');

	const g = $derived(game.game);
	/** Today's wish of theirs, changed in place. */
	const today = $derived(
		seatId === undefined
			? undefined
			: g.today.entries.findLast((e) => e.kind === 'wish' && e.seatId === seatId)
	);
	/** A wish of theirs already granted, today or earlier. */
	const earlier = $derived(seatId === undefined ? undefined : grantedWish(g, seatId));

	/** Opens the dialog for a player's wish. */
	export function ask(at: SeatId, id: CharacterId) {
		seatId = at;
		characterId = id;
		const w = g.today.entries.findLast((e) => e.kind === 'wish' && e.seatId === at);
		const wish = w?.kind === 'wish' ? w : undefined;
		text = wish?.text ?? '';
		granted = wish && !wish.granted ? 'declined' : 'granted';
		price = wish?.price ?? '';
		clue = wish?.clue ?? '';
		effect = wish?.effect ?? 'none';
		open = true;
	}

	function save(event: SubmitEvent) {
		event.preventDefault();
		if (seatId === undefined || characterId === undefined) return;
		game.run({
			type: 'RecordWish',
			...(today ? { entryId: today.entryId } : {}),
			seatId,
			characterId,
			text,
			granted: granted === 'granted',
			...(price.trim() ? { price } : {}),
			...(clue.trim() ? { clue } : {}),
			...(effect !== 'none' ? { effect } : {})
		});
		open = false;
	}

	const who = $derived(t('day.who', { character: slot('character'), seat: slot('seat') }));
	const otherGranted = $derived(earlier !== undefined && earlier.entryId !== today?.entryId);
</script>

{#snippet fill(
	name: string
)}{#if seatId === undefined || characterId === undefined}{:else if name === 'seat'}<PlayerBadge
			name={game.seatName(seatId)}
		/>{:else}<CharacterBadge
			{characterId}
			character={game.characters.get(characterId)}
			interactive={false}
		/>{/if}{/snippet}

<Dialog bind:open title={t('day.wish')}>
	<form onsubmit={save}>
		{#if seatId !== undefined && characterId !== undefined}
			<p class="who"><Sentence text={t('day.wishTitle', { who })} {fill} /></p>
		{/if}
		<TextField label={t('day.wishText')} bind:value={text} multiline rows={2} />
		<Toggle
			label={t('day.wishGranted')}
			checked={granted === 'granted'}
			onChange={(on) => (granted = on ? 'granted' : 'declined')}
		/>
		<!-- Each line keeps its place, so nothing moves when the choice changes. -->
		<p class="note" data-testid="wish-note">
			{otherGranted ? t('day.wishAgain') : granted === 'declined' ? t('day.wishDeclinedNote') : ''}
		</p>
		<TextField label={t('day.wishPrice')} bind:value={price} placeholder={t('day.wishPriceHint')} />
		<TextField label={t('day.wishClue')} bind:value={clue} placeholder={t('day.wishClueHint')} />
		<Select
			label={t('day.wishEffect')}
			value={effect}
			options={[
				{ value: 'none' as const, label: t('day.wishEffect.none') },
				...WISH_EFFECTS.map((e) => ({ value: e, label: t(`day.wishEffect.${e}`) }))
			]}
			onChange={(v) => (effect = v)}
		/>
		<ModalActions onCancel={() => (open = false)} submit confirmLabel={t('day.wishSave')} />
	</form>
</Dialog>

<style>
	form {
		display: grid;
		gap: var(--space-3);
		min-width: 0;
	}
	.who,
	.note {
		margin: 0;
	}
	.note {
		min-height: 1.4em;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
	}
</style>
