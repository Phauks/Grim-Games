<script lang="ts">
	import { untrack } from 'svelte';
	import { fieldControl, type GuideField } from '#lib/core/modes/index.ts';
	import type { CharacterId } from '#lib/core/data/index.ts';
	import { fieldLabel, modeLabel } from '#lib/features/modes/labels.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import SettingRow from '#lib/ui/settings/SettingRow.svelte';
	import NumberSelect from '#lib/ui/primitives/NumberSelect.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import TextField from '#lib/ui/primitives/TextField.svelte';
	import TextListField from '#lib/ui/primitives/TextListField.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import CharactersField from './CharactersField.svelte';
	import JsonField from './JsonField.svelte';
	import LinksField from './LinksField.svelte';

	/**
	 * One field of a mode file, its control chosen from the type the format guide gives it
	 * (core/modes/builder.ts), its label and description from the guide too. Problems are
	 * listed behind the page's Problems button, so nothing here moves as they come and go.
	 */
	interface Props {
		field: GuideField;
		/** The part (or `file`) it belongs to, for labels read differently in one part. */
		parent: string;
		value: unknown;
		/** `undefined` leaves an optional field out of the file. */
		onChange: (value: unknown) => void;
		disabled?: boolean;
	}

	let { field, parent, value, onChange, disabled = false }: Props = $props();

	const ctl = $derived(fieldControl(field));
	const label = $derived(fieldLabel(parent, field.name));
	/** Whole numbers offered in a drop-down (Trevor: number steppers are drop-downs). */
	const WHOLE_MAX = 20;
	const NONE = '';
	const SEATED = ['townsfolk', 'outsider', 'minion', 'demon'] as const;

	const text = (v: unknown) => (typeof v === 'string' ? v : '');
	const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
	const object = (v: unknown): Record<string, unknown> =>
		typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
	const wholeOptions = $derived([
		...(field.required ? [] : [{ value: NONE, label: t('common.none') }]),
		...Array.from({ length: WHOLE_MAX + 1 }, (_, n) => ({ value: String(n), label: String(n) }))
	]);
	/** Typed numbers, kept as typed until they read as a list. */
	let numbersText = $state('');
	// Follows the file when it changes elsewhere (another mode opened), not while typing.
	$effect(() => {
		const next = list(value).join(', ');
		untrack(() => {
			const typed = numbersText
				.split(/[\s,]+/)
				.filter(Boolean)
				.join(', ');
			if (typed !== next) numbersText = next;
		});
	});
	function setNumbers(typed: string) {
		numbersText = typed;
		const parts = typed
			.split(/[\s,]+/)
			.filter(Boolean)
			.map(Number);
		onChange(parts.length ? parts : field.required ? [] : undefined);
	}
	const stacked = $derived(
		['texts', 'links', 'characters', 'json', 'counts', 'numbers'].includes(ctl.kind) ||
			(ctl.kind === 'text' && (field.name === 'about' || field.name === 'instructions'))
	);
</script>

<div class="field" data-field={field.name}>
	<SettingRow {label} description={field.about} layout={stacked ? 'stacked' : 'inline'}>
		{#snippet control(labelId)}
			{#if ctl.kind === 'boolean'}
				<Toggle
					{label}
					hideLabel
					checked={value === true}
					{disabled}
					onChange={(on) => onChange(on ? true : field.required ? false : undefined)}
				/>
			{:else if ctl.kind === 'choice'}
				<Select
					labelledBy={labelId}
					{label}
					{disabled}
					value={text(value)}
					options={[
						...(field.required ? [] : [{ value: NONE, label: t('common.none') }]),
						...ctl.values.map((v) => ({ value: v, label: modeLabel('value', v) }))
					]}
					onChange={(v) => onChange(v === NONE ? undefined : v)}
				/>
			{:else if ctl.kind === 'whole'}
				<Select
					labelledBy={labelId}
					{label}
					{disabled}
					value={typeof value === 'number' ? String(value) : NONE}
					options={wholeOptions}
					onChange={(v) => onChange(v === NONE ? undefined : Number(v))}
				/>
			{:else if ctl.kind === 'choices'}
				<Select
					labelledBy={labelId}
					{label}
					{disabled}
					multiple
					placeholder={t('common.none')}
					values={list(value).filter((v): v is string => typeof v === 'string')}
					options={ctl.values.map((v) => ({ value: v, label: modeLabel('value', v) }))}
					onValuesChange={(vs) => onChange(vs.length ? vs : field.required ? [] : undefined)}
				/>
			{:else if ctl.kind === 'texts'}
				<TextListField
					{label}
					values={list(value).map(text)}
					onChange={(vs) => onChange(vs.length ? vs : field.required ? [] : undefined)}
					rowLabel={(n) => t('modes.builder.line', { number: n })}
					removeLabel={(n) => t('modes.builder.removeLine', { number: n })}
					addLabel={t('modes.builder.addLine')}
				/>
			{:else if ctl.kind === 'numbers'}
				<TextField
					{label}
					hideLabel
					{disabled}
					inputmode="numeric"
					value={numbersText}
					filter={(v) => v.replace(/[^\d,\s]/g, '')}
					oninput={setNumbers}
				/>
			{:else if ctl.kind === 'characters'}
				<CharactersField
					{label}
					{disabled}
					ids={list(value).filter((v): v is CharacterId => typeof v === 'string')}
					onChange={(ids) => onChange(ids.length ? ids : field.required ? [] : undefined)}
				/>
			{:else if ctl.kind === 'links'}
				<LinksField
					{disabled}
					links={list(value)}
					onChange={(links) => onChange(links.length ? links : field.required ? [] : undefined)}
				/>
			{:else if ctl.kind === 'counts'}
				<div class="counts">
					{#each SEATED as type (type)}
						{@const counts = object(value)}
						<NumberSelect
							label={modeLabel('value', type)}
							{disabled}
							min={0}
							max={WHOLE_MAX}
							value={typeof counts[type] === 'number' ? (counts[type] as number) : 0}
							onchange={(n) => {
								const next = { ...counts, [type]: n };
								if (n === 0) delete next[type];
								onChange(Object.keys(next).length || field.required ? next : undefined);
							}}
						/>
					{/each}
				</div>
			{:else if ctl.kind === 'range'}
				{@const range = object(value)}
				<div class="counts">
					{#each ['min', 'max'] as end (end)}
						<Select
							label={t(end === 'min' ? 'modes.builder.min' : 'modes.builder.max')}
							{disabled}
							value={typeof range[end] === 'number' ? String(range[end]) : NONE}
							options={[
								{ value: NONE, label: t('common.none') },
								...wholeOptions.filter((o) => o.value !== NONE)
							]}
							onChange={(v) => {
								const next = { ...range, [end]: v === NONE ? undefined : Number(v) };
								if (next[end] === undefined) delete next[end];
								onChange(Object.keys(next).length ? next : undefined);
							}}
						/>
					{/each}
				</div>
			{:else if ctl.kind === 'json'}
				<JsonField {label} {value} {disabled} {onChange} />
			{:else}
				<TextField
					{label}
					hideLabel
					{disabled}
					type={ctl.kind === 'link' ? 'url' : 'text'}
					multiline={stacked}
					rows={3}
					value={text(value)}
					oninput={(v) => onChange(v === '' && !field.required ? undefined : v)}
				/>
			{/if}
		{/snippet}
	</SettingRow>
</div>

<style>
	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
</style>
