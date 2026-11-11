<script lang="ts">
	import { MOVING_BACKGROUNDS, type MovingChoice } from '#lib/core/backgrounds/moving.ts';
	import {
		formatParam,
		matchingPreset,
		paramPreset,
		type ParamValue,
		type Params
	} from '#lib/core/backgrounds/params.ts';
	import { STILL_BACKGROUNDS, type StillChoice } from '#lib/core/backgrounds/still.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import ModalActions from '#lib/ui/primitives/ModalActions.svelte';
	import SettingColor from '#lib/ui/settings/SettingColor.svelte';
	import SettingSelect from '#lib/ui/settings/SettingSelect.svelte';
	import SettingSlider from '#lib/ui/settings/SettingSlider.svelte';
	import SettingToggle from '#lib/ui/settings/SettingToggle.svelte';
	import type { BackgroundChoice } from './backgrounds.ts';
	import BoardBackdrop from './BoardBackdrop.svelte';

	/**
	 * "Customise" under the background tiles, for the still backgrounds (M72) and the animated
	 * ones (M43): always there, so nothing moves, and only usable while one of them is chosen.
	 * It opens that background's settings in a dialog with its own preview; nothing changes on
	 * the board until Confirm.
	 */
	interface Props {
		current: BackgroundChoice | undefined;
		onSave: (choice: BackgroundChoice) => void;
	}
	let { current, onSave }: Props = $props();

	type Draft = ({ kind: 'preset' } & StillChoice) | ({ kind: 'moving' } & MovingChoice);
	const editable = $derived(
		current?.kind === 'preset' || current?.kind === 'moving' ? current : undefined
	);
	const setOf = (choice: Draft) =>
		choice.kind === 'moving' ? MOVING_BACKGROUNDS[choice.id] : STILL_BACKGROUNDS[choice.id];

	let open = $state(false);
	let draft = $state<Draft>({ kind: 'preset', id: 'felt', params: {} });
	const background = $derived(setOf(draft));
	/** The preset the draft matches, or '' once a setting is the Storyteller's own. */
	const preset = $derived(matchingPreset(background, draft.params) ?? '');

	function start() {
		if (!editable) return;
		draft = { ...editable, params: { ...editable.params } } as Draft;
		open = true;
	}
	const set = (id: string, value: ParamValue) =>
		(draft.params = { ...draft.params, [id]: value } as Params);

	function confirm() {
		onSave({ ...draft, params: $state.snapshot(draft.params) } as BackgroundChoice);
		open = false;
	}
</script>

<Button variant="quiet" icon="edit" disabled={!editable} onclick={start}>
	{editable ? `Customise ${setOf(editable).label}` : 'Customise a background'}
</Button>

<Dialog bind:open title={`Customise ${background.label}`} size="full">
	{#snippet aside()}
		<div class="preview" data-testid="background-preview">
			<BoardBackdrop
				contained
				preset={draft.kind === 'preset' ? draft : undefined}
				moving={draft.kind === 'moving' ? draft : undefined}
			/>
		</div>
	{/snippet}
	<div data-testid="background-customise">
		<SettingSelect
			label="Preset"
			value={preset}
			options={[
				...Object.keys(background.presets).map((name) => ({ value: name, label: name })),
				...(preset ? [] : [{ value: '', label: 'Your own' }])
			]}
			onChange={(name) => {
				if (name) draft.params = paramPreset(background, name);
			}}
		/>
		{#each background.params as param (param.id)}
			{@const value = draft.params[param.id]}
			{@const off = !!param.when && draft.params[param.when] !== true}
			{#if param.type === 'colour'}
				<!-- A colour picker has no disabled state of its own: held in place, faded. -->
				<div class="param" class:off inert={off}>
					<SettingColor
						label={param.label}
						value={String(value)}
						custom={value !== param.value}
						onChange={(v) => set(param.id, v)}
						onReset={() => set(param.id, param.value)}
					/>
				</div>
			{:else if param.type === 'range'}
				<SettingSlider
					label={param.label}
					value={Number(value)}
					min={param.min}
					max={param.max}
					step={param.step}
					defaultValue={param.value}
					format={(v) => formatParam(param, v)}
					disabled={off}
					onChange={(v) => set(param.id, v)}
				/>
			{:else}
				<SettingToggle
					label={param.label}
					checked={value === true}
					disabled={off}
					onChange={(v) => set(param.id, v)}
				/>
			{/if}
		{/each}
	</div>
	{#snippet actions()}
		<ModalActions onCancel={() => (open = false)} onConfirm={confirm} />
	{/snippet}
</Dialog>

<style>
	.preview {
		position: relative;
		width: 100%;
		aspect-ratio: 3 / 2;
		overflow: hidden;
		border-radius: var(--radius-md);
		isolation: isolate;
	}
	.param.off {
		opacity: 0.4;
	}
</style>
