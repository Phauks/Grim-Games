<script lang="ts">
	import DeleteButton from '#lib/ui/primitives/DeleteButton.svelte';
	import { loadScript } from '#lib/core/data/index.ts';
	import { loadOfficialData } from '#lib/features/characters/game-data.svelte.ts';
	import { chooseScript } from '#lib/features/scripts/current-script.svelte.ts';
	import { describeSource } from '#lib/features/scripts/saved-scripts.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { profileScripts } from './profile-scripts.svelte.ts';
	import {
		canBeOnline,
		onlineSourceLabel,
		type ProfileScript,
		type ProfileScriptEntry
	} from './profile-scripts.ts';

	let selectedId = $state<string | undefined>(undefined);
	let open = $state(false);
	let newer = $state.raw<ProfileScript | undefined>(undefined);
	let message = $state('');
	let busy = $state(false);

	const selected = $derived(profileScripts.list.find((entry) => entry.id === selectedId));

	function show(entry: ProfileScriptEntry): void {
		selectedId = entry.id;
		newer = undefined;
		message = '';
		open = true;
	}

	async function run(action: (entry: ProfileScriptEntry) => Promise<void>): Promise<void> {
		const entry = selected;
		if (!entry) return;
		busy = true;
		message = '';
		try {
			await action(entry);
		} catch (e) {
			message = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}

	const use = () =>
		run(async (entry) => {
			const { script } = loadScript(entry.script.json, await loadOfficialData());
			if (!script) throw new Error(t('account.scripts.unknownCharacters'));
			await chooseScript(script, entry.script.source);
			open = false;
			toast(t('account.scripts.nowCurrent', { name: entry.script.name }));
		});

	const check = () =>
		run(async (entry) => {
			newer = await profileScripts.checkForUpdate(entry);
			if (!newer) message = t('account.scripts.latest');
		});

	const update = () =>
		run(async (entry) => {
			if (!newer) return;
			await profileScripts.applyUpdate(entry, newer);
			newer = undefined;
			message = t('account.scripts.updated');
		});

	const unlink = () =>
		run(async (entry) => {
			await profileScripts.unlink(entry);
			newer = undefined;
			message = t('account.scripts.unlinked');
		});

	const remove = () =>
		run(async (entry) => {
			await profileScripts.remove(entry);
			open = false;
			toast(t('account.scripts.removed', { name: entry.script.name }));
		});

	function sourceLine(script: ProfileScript): string {
		return script.online ? onlineSourceLabel(script.source) : describeSource(script.source);
	}
</script>

{#if profileScripts.status === 'error'}
	<p class="empty" role="status">
		{t('account.scripts.loadFailed', { reason: profileScripts.error ?? '' })}
		<Button variant="quiet" onclick={() => profileScripts.refresh()}
			>{t('account.scripts.retry')}</Button
		>
	</p>
{:else if profileScripts.list.length === 0}
	<p class="empty">
		{profileScripts.status === 'ready' || profileScripts.status === 'idle'
			? t('account.scripts.none')
			: t('account.loading')}
	</p>
{:else}
	<ul class="scripts" data-testid="profile-scripts">
		{#each profileScripts.list as entry (entry.id)}
			<li>
				<button type="button" class="row" onclick={() => show(entry)}>
					<span class="name">{entry.script.name || t('account.scripts.untitled')}</span>
					<span class="tag" data-online={entry.script.online}>
						{entry.script.online ? t('account.scripts.online') : t('account.scripts.localCopy')}
					</span>
					<span class="source">{sourceLine(entry.script)}</span>
				</button>
			</li>
		{/each}
	</ul>
{/if}

<Dialog bind:open title={selected?.script.name || t('account.scripts.dialogTitle')}>
	{#if selected}
		<dl>
			<dt>{t('account.scripts.keptAs')}</dt>
			<dd>
				{selected.script.online ? t('account.scripts.keptOnline') : t('account.scripts.localCopy')}
			</dd>
			<dt>{t('account.scripts.onlineVersion')}</dt>
			<dd>
				{selected.script.online ? onlineSourceLabel(selected.script.source) : t('common.none')}
			</dd>
			<dt>{t('account.scripts.cameFrom')}</dt>
			<dd>{describeSource(selected.script.source)}</dd>
			<dt>{t('account.scripts.newerVersion')}</dt>
			<dd data-testid="newer-version">
				{newer
					? newer.source.kind === 'botcscripts'
						? t('account.scripts.version', { version: newer.source.version })
						: t('account.scripts.linkChanged')
					: t('common.none')}
			</dd>
		</dl>
		<p class="message" role="status">{message}</p>
	{/if}
	<!-- Delete sits next to the X (Trevor, 2026-10-17). -->
	{#snippet headActions()}
		<DeleteButton label={t('account.scripts.remove')} onclick={remove} disabled={busy} />
	{/snippet}
	{#snippet actions()}
		<Button
			variant="quiet"
			onclick={unlink}
			disabled={busy || !selected?.script.online || !canBeOnline(selected.script.source)}
			>{t('account.scripts.unlink')}</Button
		>
		{#if newer}
			<Button variant="accent" onclick={update} disabled={busy}
				>{t('account.scripts.update')}</Button
			>
		{:else}
			<Button variant="quiet" onclick={check} disabled={busy || !selected?.script.online}
				>{t('account.scripts.check')}</Button
			>
		{/if}
		<Button variant="accent" onclick={use} disabled={busy}>{t('account.scripts.use')}</Button>
	{/snippet}
</Dialog>

<style>
	.scripts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		gap: var(--space-2);
	}
	.row {
		width: 100%;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: var(--space-1) var(--space-2);
		align-items: center;
		padding: var(--space-2) var(--space-3);
		border: var(--card-border);
		border-radius: var(--card-radius);
		background: var(--card-background);
		text-align: left;
	}
	.row:hover {
		background: var(--surface-selected);
	}
	.name {
		color: var(--heading);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.source {
		grid-column: 1 / -1;
		color: var(--on-surface-muted);
		font-size: 0.9rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		padding: 0 var(--space-2);
		border-radius: var(--radius-full);
		border: 1px solid var(--border);
		font-size: 0.8rem;
		color: var(--on-surface-muted);
	}
	.tag[data-online='true'] {
		border-color: var(--good);
		color: var(--good-text);
	}
	.empty {
		margin: 0;
		color: var(--on-surface-muted);
	}
	dl {
		margin: 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--space-1) var(--space-3);
	}
	dt {
		color: var(--on-surface-muted);
	}
	dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	/* Two lines reserved, so results never move the buttons. */
	.message {
		min-height: 2lh;
		margin: var(--space-2) 0 0;
	}
</style>
