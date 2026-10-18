<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import type { Character, CharacterId } from '#lib/core/data/index.ts';
	import {
		SEATED_TYPES,
		setupPartText,
		type SeatedType,
		type SetupPart,
		type SetupPartKind
	} from '#lib/core/rules/index.ts';
	import CharacterBadge from '#lib/features/characters/CharacterBadge.svelte';
	import CharacterPicker from '#lib/features/characters/CharacterPicker.svelte';
	import { TYPE_LABELS } from '#lib/features/reference/labels.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Stepper from '#lib/ui/primitives/Stepper.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';

	/**
	 * Builds one clause of a setup bracket from its standard parts (Trevor, 2026-10-18: "see
	 * what standard things we can create to change setup ... Allow linking to other
	 * characters (think king and choirboy)"). Every control is always there and only the ones
	 * the change uses are enabled, so choosing a different change moves nothing.
	 */
	interface Props {
		open: boolean;
		/** This character's name, for "+0 to +2 [name]s". */
		self: string;
		/** The characters a "+the [character]" link can name. */
		characters: readonly Character[];
		onAdd: (part: SetupPart) => void;
	}

	let { open = $bindable(), self, characters, onAdd }: Props = $props();

	let kind = $state<SetupPartKind>('count');
	let type = $state<SeatedType>('outsider');
	let from = $state(1);
	let second = $state<'none' | 'or' | 'to'>('none');
	let to = $state(1);
	let linked = $state<CharacterId>();
	let text = $state('');
	let pickerOpen = $state(false);

	$effect(() => {
		if (!open) return;
		kind = 'count';
		type = 'outsider';
		from = 1;
		second = 'none';
		to = 1;
		linked = undefined;
		text = '';
	});

	const linkedCharacter = $derived(characters.find((c) => c.id === linked));

	const part = $derived.by((): SetupPart | undefined => {
		switch (kind) {
			case 'count':
				return second === 'none' ? { kind, type, from } : { kind, type, from, to, join: second };
			case 'any':
			case 'none':
				return { kind, type };
			case 'copies':
				return { kind, from: Math.max(0, from), to: Math.max(0, from, to) };
			case 'character':
				return linkedCharacter
					? { kind, id: linkedCharacter.id, name: linkedCharacter.name }
					: undefined;
			case 'text':
				return text.trim() ? { kind, text } : undefined;
		}
		return undefined;
	});

	const KINDS: readonly SetupPartKind[] = ['count', 'any', 'none', 'copies', 'character', 'text'];
	const kindOptions = KINDS.map((value) => ({
		value,
		label: t(`character-builder.setupKind.${value}`)
	}));
	const typeOptions = SEATED_TYPES.map((value) => ({ value, label: TYPE_LABELS[value] }));
	const secondOptions = (['none', 'or', 'to'] as const).map((value) => ({
		value,
		label: t(`character-builder.second.${value}`)
	}));

	const usesType = $derived(kind === 'count' || kind === 'any' || kind === 'none');
	const usesNumbers = $derived(kind === 'count' || kind === 'copies');
	const min = $derived(kind === 'copies' ? 0 : -9);

	function add() {
		if (!part) return;
		onAdd(part);
		open = false;
	}
</script>

<Dialog bind:open title={t('character-builder.setupPartTitle')} size="full">
	<div class="part">
		<Select
			label={t('character-builder.setupKind')}
			value={kind}
			options={kindOptions}
			onChange={(v: SetupPartKind) => (kind = v)}
		/>
		<p class="result" data-testid="setup-part-preview">
			[{part ? setupPartText(part, self) : '…'}]
		</p>
		<Select
			label={t('character-builder.type')}
			value={type}
			options={typeOptions}
			disabled={!usesType}
			onChange={(v: SeatedType) => (type = v)}
		/>
		<div class="number">
			<span class="label">{t('character-builder.number')}</span>
			<Stepper
				bind:value={from}
				{min}
				max={9}
				label={t('character-builder.number')}
				lessLabel={t('character-builder.lessNumber')}
				moreLabel={t('character-builder.moreNumber')}
				disabled={!usesNumbers}
				testid="setup-from"
			/>
		</div>
		<div class="number second">
			<Select
				label={t('character-builder.second')}
				value={kind === 'copies' ? 'to' : second}
				options={secondOptions}
				disabled={kind !== 'count'}
				onChange={(v: 'none' | 'or' | 'to') => (second = v)}
			/>
			<Stepper
				bind:value={to}
				{min}
				max={9}
				label={t('character-builder.secondNumber')}
				lessLabel={t('character-builder.lessSecond')}
				moreLabel={t('character-builder.moreSecond')}
				disabled={kind === 'count' ? second === 'none' : kind !== 'copies'}
				testid="setup-to"
			/>
		</div>
		<div class="linked">
			<Button disabled={kind !== 'character'} onclick={() => (pickerOpen = true)}
				>{t('character-builder.chooseLinked')}</Button
			>
			{#if linkedCharacter}
				<CharacterBadge characterId={linkedCharacter.id} character={linkedCharacter} inline />
			{:else}
				<span class="muted">{t('common.none')}</span>
			{/if}
		</div>
		<TextField
			label={t('character-builder.setupText')}
			bind:value={text}
			disabled={kind !== 'text'}
			oncommit={add}
		/>
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={add} disabled={!part} />
	{/snippet}
</Dialog>

<Dialog bind:open={pickerOpen} title={t('character-builder.chooseLinked')} size="full">
	<CharacterPicker
		{characters}
		selected={linked ? [linked] : []}
		onSelect={(id) => {
			linked = id;
			pickerOpen = false;
		}}
	/>
</Dialog>

<style>
	.part {
		display: grid;
		gap: var(--space-3);
	}
	.number {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.second {
		align-items: end;
	}
	.label {
		font-weight: 600;
	}
	.linked {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: var(--tap-target);
	}
	.muted {
		color: var(--on-surface-muted);
	}
	.result {
		margin: 0;
		font-style: italic;
	}
</style>
