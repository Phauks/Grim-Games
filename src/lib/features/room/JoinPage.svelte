<script lang="ts">
	import { t } from '#lib/i18n/locale.svelte.ts';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatRoomCode, normaliseRoomCode } from '#lib/core/sync/room-code.ts';
	import Page from '#lib/ui/layout/Page.svelte';
	import Button from '#lib/ui/primitives/Button.svelte';
	import JoinPanel from './JoinPanel.svelte';

	interface Props {
		/** The code from the link; undefined on /join, where it is typed. */
		code?: string;
	}

	let { code }: Props = $props();

	const valid = $derived(code === undefined ? null : normaliseRoomCode(code));
	let joined = $state(false);
	let scriptName = $state<string>();
</script>

{#snippet scriptLine()}
	<span data-testid="room-script">
		{t('room.scriptLine', {
			name: scriptName === undefined ? t('common.none') : scriptName || t('common.none')
		})}
	</span>
{/snippet}
{#snippet readScript()}
	<Button icon="script" disabled={scriptName === undefined} onclick={() => goto(resolve('/play'))}>
		{t('room.readScript')}
	</Button>
{/snippet}

<Page
	title={valid ? t('room.roomTitle', { code: formatRoomCode(valid) }) : t('room.joinTitle')}
	subtitle={joined ? scriptLine : undefined}
	actions={joined ? readScript : undefined}
	columns={joined}
>
	<JoinPanel {code} onJoined={(j) => (joined = j)} onScript={(name) => (scriptName = name)} />
</Page>
