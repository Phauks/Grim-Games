<script lang="ts">
	import { buildInfo } from '#lib/build-info.ts';
	import { describeBuild } from '#lib/features/about/report-issue.ts';
	import { scrubUrls } from '#lib/features/errors/app-error.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import ClearableField from '#lib/ui/primitives/ClearableField.svelte';
	import Collapsible from '#lib/ui/primitives/Collapsible.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import Select from '#lib/ui/primitives/Select.svelte';
	import Toggle from '#lib/ui/primitives/Toggle.svelte';
	import { toast } from '#lib/ui/primitives/toaster.ts';
	import { reportDialog } from './report-dialog.svelte.ts';
	import { sendReport } from './reports-api.ts';
	import { REPORT_KINDS, REPORT_LIMITS, type ReportKind } from './reports-protocol.ts';

	// The one Report form (Trevor, 2026-10-17: reports go to our Worker, not GitHub). Nothing
	// leaves the device until Send, and "Sent with it" shows everything sent besides the text.

	let kind = $state<ReportKind>('bug');
	let title = $state('');
	let body = $state('');
	let contact = $state('');
	let includeDetails = $state(true);
	let sending = $state(false);
	let sentId = $state<number>();
	let page = $state('');

	$effect(() => {
		void reportDialog.opened;
		const start = reportDialog.start;
		kind = start.kind ?? 'bug';
		title = start.title ?? '';
		body = '';
		includeDetails = true;
		sending = false;
		sentId = undefined;
		page = scrubUrls(location.pathname);
	});

	const details = $derived(reportDialog.start.details);
	const build = describeBuild(buildInfo);
	const ready = $derived(title.trim() !== '' && body.trim() !== '' && !sending);
	const kinds = $derived(
		REPORT_KINDS.map((value) => ({ value, label: t(`reports.kind.${value}`) }))
	);

	/** Enter in a single-line field sends (UI rules). */
	function onkeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') void send(event);
	}

	async function send(event?: Event) {
		event?.preventDefault();
		if (!ready) return;
		sending = true;
		try {
			sentId = await sendReport({
				kind,
				title,
				body,
				...(contact.trim() ? { contact } : {}),
				...(details && includeDetails ? { details } : {}),
				page,
				build,
				device: navigator.userAgent
			});
		} catch {
			toast(t('reports.sendFailed'), t('reports.sendFailedDetail'));
		} finally {
			sending = false;
		}
	}
</script>

<Dialog bind:open={reportDialog.open} title={t('reports.title')}>
	{#if sentId !== undefined}
		<p class="sent" data-testid="report-sent">{t('reports.sent', { id: sentId })}</p>
	{:else}
		<form class="form" onsubmit={send} data-testid="report-form">
			<Select label={t('reports.kind')} value={kind} options={kinds} onChange={(v) => (kind = v)} />
			<label class="field">
				<span>{t('reports.summary')}</span>
				<ClearableField bind:value={title}>
					<input
						type="text"
						bind:value={title}
						maxlength={REPORT_LIMITS.title}
						required
						{onkeydown}
					/>
				</ClearableField>
			</label>
			<label class="field">
				<span>{t('reports.body')}</span>
				<textarea bind:value={body} rows="5" maxlength={REPORT_LIMITS.body} required></textarea>
			</label>
			<label class="field">
				<span>{t('reports.contact')}</span>
				<ClearableField bind:value={contact}>
					<input type="text" bind:value={contact} maxlength={REPORT_LIMITS.contact} {onkeydown} />
				</ClearableField>
			</label>
			{#if details}
				<Toggle
					label={t('reports.includeDetails')}
					checked={includeDetails}
					onChange={(v) => (includeDetails = v)}
				/>
			{/if}
			<Collapsible title={t('reports.sentWith')} level={3}>
				<dl class="sent-with">
					<dt>{t('reports.page')}</dt>
					<dd>{page}</dd>
					<dt>{t('reports.build')}</dt>
					<dd>{build}</dd>
					<dt>{t('reports.device')}</dt>
					<dd>{navigator.userAgent}</dd>
				</dl>
				{#if details}
					<pre class="details" class:excluded={!includeDetails}>{details}</pre>
				{/if}
			</Collapsible>
		</form>
	{/if}
	{#snippet actions()}
		{#if sentId !== undefined}
			<Button onclick={() => (reportDialog.open = false)}>{t('common.close')}</Button>
		{:else}
			<Button variant="quiet" onclick={() => (reportDialog.open = false)}
				>{t('common.cancel')}</Button
			>
			<Button variant="accent" disabled={!ready} onclick={() => send()}>{t('reports.send')}</Button>
		{/if}
	{/snippet}
</Dialog>

<style>
	.form {
		display: grid;
		gap: var(--space-3);
	}
	.field {
		display: grid;
		gap: var(--space-1);
		font-size: 0.9rem;
	}
	.field input,
	.field textarea {
		width: 100%;
		box-sizing: border-box;
	}
	.sent {
		margin: 0;
	}
	.sent-with {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--space-1) var(--space-3);
		margin: 0;
		font-size: 0.8rem;
	}
	.sent-with dt {
		color: var(--on-surface-muted);
	}
	.sent-with dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
	.details {
		max-height: 30vh;
		margin: var(--space-2) 0 0;
		overflow: auto;
		font-size: 0.75rem;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.details.excluded {
		opacity: 0.4;
		text-decoration: line-through;
	}
</style>
