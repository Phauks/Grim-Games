<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import ScanFieldDialog from './ScanFieldDialog.svelte';
	import {
		GROUP_CODE_LENGTH,
		MAX_GROUP_NAME,
		normaliseGroupCode,
		normaliseGroupName,
		readGroupLink
	} from './groups-protocol.ts';
	import { groups } from './groups.svelte.ts';

	/**
	 * Starts a group by name, or joins one by its code (plan F6), as Add friend asks by
	 * username: Enter commits, a refusal stays in the dialog, and the camera reads a group's
	 * QR code into the field. `ondone` gets the group's code.
	 */
	interface Props {
		open?: boolean;
		mode: 'new' | 'join';
		initial?: string;
		ondone?: (code: string) => void;
	}

	let { open = $bindable(false), mode, initial = '', ondone }: Props = $props();

	let value = $state('');
	let error = $state('');
	let busy = $state(false);
	const valid = $derived(mode === 'new' ? normaliseGroupName(value) : normaliseGroupCode(value));

	$effect(() => {
		if (open) {
			value = initial;
			error = '';
		}
	});

	async function commit(): Promise<void> {
		if (!valid || busy) return;
		busy = true;
		error = '';
		try {
			const answer = mode === 'new' ? await groups.create(valid) : await groups.join(valid);
			if (answer.ok) {
				open = false;
				ondone?.(answer.code);
			} else error = t(`friends.groups.refused.${answer.reason}`);
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
</script>

<ScanFieldDialog
	bind:open
	bind:value
	title={t(mode === 'new' ? 'friends.groups.new' : 'friends.groups.join')}
	label={t(mode === 'new' ? 'friends.groups.name' : 'friends.groups.code')}
	maxlength={mode === 'new' ? MAX_GROUP_NAME : GROUP_CODE_LENGTH + 2}
	valid={!!valid}
	{busy}
	{error}
	confirmLabel={t(mode === 'new' ? 'friends.groups.create' : 'friends.groups.joinOne')}
	onConfirm={() => void commit()}
	read={mode === 'join' ? (text) => readGroupLink(text) ?? normaliseGroupCode(text) : undefined}
	notCode={t('friends.groups.notGroupCode')}
/>
