<script lang="ts">
	import { onDestroy } from 'svelte';
	import { reminderHolder, type ReminderInstance } from '#lib/core/model/index.ts';
	import {
		effectNight,
		pickedEffectOf,
		type ReminderEffectKind
	} from '#lib/core/rules/reminder-effects.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import type { Grimoire } from './grimoire.svelte.ts';

	/**
	 * What a reminder whose effect the Storyteller picks does (`pickedEffect`: the Angel's
	 * Something Bad, M17f), in its reminder dialog: one the rules know (the marked player kills no
	 * one on the next night, shown at their night step), or the Storyteller's own words.
	 */
	interface Props {
		grimoire: Grimoire;
		reminder: ReminderInstance;
	}

	let { grimoire, reminder }: Props = $props();

	const NONE = 'none';
	type Choice = ReminderEffectKind | typeof NONE;
	const rule = $derived(pickedEffectOf(reminder, grimoire.open.characters));
	const options = $derived([
		{ value: NONE as Choice, label: t('characters.effectNone') },
		...(rule?.effects ?? []).map((kind) => ({
			value: kind as Choice,
			label: t(`characters.effect.${kind}`)
		}))
	]);
	// Already taken off the board: nothing to save it on.
	const held = () => !!reminderHolder(grimoire.game, reminder.reminderId);

	function pick(value: Choice) {
		if (!held()) return;
		const night = effectNight(grimoire.game, grimoire.nightUnderway);
		grimoire.run({
			type: 'SetReminderEffect',
			reminderId: reminder.reminderId,
			...(value === NONE ? {} : { effect: { kind: value, night } })
		});
	}

	const saved = $derived(reminder.note ?? '');
	// Typed text, reset whenever the saved note changes.
	let text = $derived(saved);
	function save() {
		const note = text.trim();
		if (note === saved || !held()) return;
		grimoire.run({ type: 'SetReminderNote', reminderId: reminder.reminderId, note });
	}
	onDestroy(save);
</script>

<div class="effect" data-testid="reminder-effect">
	<Select
		label={t('characters.effectLabel')}
		value={reminder.effect?.kind ?? NONE}
		{options}
		onChange={pick}
	/>
	<TextField
		label={t('characters.effectNote')}
		bind:value={text}
		enterkeyhint="done"
		oncommit={save}
		testid="reminder-effect-note"
	/>
</div>

<style>
	.effect {
		display: grid;
		gap: var(--space-2);
		margin: 0 0 var(--space-3);
	}
</style>
