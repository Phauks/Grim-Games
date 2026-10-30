<script lang="ts">
	import type { CharacterId } from '#lib/core/data/index.ts';
	import type { DayUseWho } from '#lib/core/data/character-rules.ts';
	import type { SeatId } from '#lib/core/model/index.ts';
	import { dayUseSuggestion } from '#lib/core/rules/index.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import ReminderToken from '#lib/features/characters/ReminderToken.svelte';
	import Sentence from '#lib/features/characters/Sentence.svelte';
	import { slot } from '#lib/features/characters/slots.ts';
	import SeatChooser from '#lib/features/grimoire/SeatChooser.svelte';
	import ChangeList from '#lib/ui/primitives/ChangeList.svelte';
	import Chip from '#lib/ui/primitives/Chip.svelte';
	import ConfirmDialog from '#lib/ui/primitives/ConfirmDialog.svelte';
	import PlayerBadge from '#lib/ui/seating/PlayerBadge.svelte';
	import type { DayPort } from './day-port.ts';

	/**
	 * Marking a day ability used asks who it was used on (Trevor, 2026-10-30): the player the
	 * Slayer chose, the Virgin's nominator, the nominee the Judge ruled on (`dayUse` in its
	 * rules block). When today's nominations already name them, the confirm opens with them
	 * filled in; otherwise the seats come first. Either way the player can be changed, or left
	 * as None, before Confirm (warn, never lock).
	 */
	interface Props {
		game: DayPort;
	}

	let { game }: Props = $props();

	interface Use {
		seatId: SeatId;
		characterId: CharacterId;
		who: DayUseWho;
	}
	// TPI's reminder token text (game data, not interface text).
	const NO_ABILITY = 'No Ability';

	let use = $state<Use>();
	let on = $state<SeatId>();
	let chooserOpen = $state(false);
	let confirmOpen = $state(false);

	/** Starts asking for one seat's ability. */
	export function ask(next: Use) {
		use = next;
		on = dayUseSuggestion(game.game, next.seatId, next.who);
		if (on) confirmOpen = true;
		else chooserOpen = true;
	}

	function chose(seatId: SeatId | undefined) {
		on = seatId;
		chooserOpen = false;
		confirmOpen = true;
	}

	function change() {
		confirmOpen = false;
		chooserOpen = true;
	}

	function confirm() {
		if (!use) return;
		const { seatId, characterId } = use;
		game.run({ type: 'UseAbility', seatId, characterId, ...(on ? { on } : {}) });
	}

	const who = t('day.who', { character: slot('character'), seat: slot('seat') });
	const token = $derived(
		use ? game.characters.get(use.characterId)?.reminders.includes(NO_ABILITY) : false
	);
</script>

{#snippet fill(name: string)}{#if !use}{:else if name === 'seat'}<PlayerBadge
			name={game.seatName(use.seatId)}
		/>{:else if name === 'reminder'}<ReminderToken
			label={NO_ABILITY}
			character={game.characters.get(use.characterId)}
		/>{:else}<CharacterBadge
			characterId={use.characterId}
			character={game.characters.get(use.characterId)}
			interactive={false}
		/>{/if}{/snippet}

<SeatChooser
	bind:open={chooserOpen}
	title={use ? t(`day.useWho.${use.who}`, { who }) : ''}
	game={game.game}
	characters={game.characters}
	exclude={use?.who === 'chosen' ? undefined : use?.seatId}
	onChoose={chose}
	onNone={() => chose(undefined)}
>
	{#snippet heading()}
		{#if use}<Sentence text={t(`day.useWho.${use.who}`, { who })} {fill} />{/if}
	{/snippet}
</SeatChooser>

<ConfirmDialog bind:open={confirmOpen} title={t('day.markUsed')} onConfirm={confirm}>
	{#snippet heading()}
		<Sentence text={t('day.markUsedTitle', { who })} {fill} />
	{/snippet}
	{#if use}
		<ChangeList testid="day-use">
			<dt>{t('day.now')}</dt>
			<dd><Sentence text={t('day.markUsedNow', { who })} {fill} /></dd>
			<dt>{t('day.after')}</dt>
			<dd>
				<Sentence
					text={token
						? t('day.markUsedAfterToken', { who, reminder: slot('reminder') })
						: t('day.markUsedAfter', { who })}
					{fill}
				/>
			</dd>
			<dt>{t(`day.useOn.${use.who}`)}</dt>
			<dd>
				<!-- eslint-disable grim/names-as-badges -- accessible name (aria-label) only -->
				<Chip
					data-testid="day-use-on"
					aria-label={t('day.useOnChange', {
						role: t(`day.useOn.${use.who}`),
						name: on ? game.seatName(on) : t('day.useOnNone')
					})}
					onclick={change}
					>{#if on}<PlayerBadge name={game.seatName(on)} />{:else}{t('day.useOnNone')}{/if}</Chip
				>
				<!-- eslint-enable grim/names-as-badges -->
			</dd>
		</ChangeList>
	{/if}
</ConfirmDialog>
