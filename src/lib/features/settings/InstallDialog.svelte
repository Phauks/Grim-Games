<script lang="ts">
	import {
		inAppHost,
		openOutsideLink,
		type InstallRoute
	} from '#lib/core/install/install-route.ts';
	import type { MessageKey } from '#lib/i18n/catalog.ts';
	import { t } from '#lib/i18n/locale.svelte.ts';
	import Icon from '#lib/ui/icons/Icon.svelte';
	import type { IconSlot } from '#lib/ui/icons/catalogue.ts';
	import Button from '#lib/ui/primitives/Button.svelte';
	import Dialog from '#lib/ui/primitives/Dialog.svelte';
	import CopyButton from '#lib/ui/share/CopyButton.svelte';
	import { installApp } from './install-app.svelte.ts';

	/**
	 * The Install app dialog (Trevor, 2026-11-16, option B): the one place that says how to
	 * install, opened by every Install app button (Settings, the menu, Settings > Data) through
	 * `installApp.start()`. Numbered steps with the icon to look for, picked by browser; an app's
	 * own web view (the Google app) gets Open in Safari or Chrome and Copy link first, then that
	 * browser's steps. Drawn once in the layout.
	 */
	type Step = { icon: IconSlot; text: MessageKey; detail?: MessageKey };

	const SAFARI: Step[] = [
		{
			icon: 'more',
			text: 'settings.install.safariMore',
			detail: 'settings.install.safariMoreDetail'
		},
		{ icon: 'iosShare', text: 'settings.install.share' },
		{
			icon: 'addToHome',
			text: 'settings.install.addToHome',
			detail: 'settings.install.addToHomeDetail'
		},
		{ icon: 'check', text: 'settings.install.add', detail: 'settings.install.addDetail' }
	];
	const IOS_BROWSER: Step[] = [
		{
			icon: 'iosShare',
			text: 'settings.install.share',
			detail: 'settings.install.browserShareDetail'
		},
		{ icon: 'addToHome', text: 'settings.install.addToHome' },
		{ icon: 'check', text: 'settings.install.add' }
	];
	const ANDROID: Step[] = [
		{ icon: 'browserMenu', text: 'settings.install.menu', detail: 'settings.install.menuDetail' },
		{ icon: 'installApp', text: 'settings.install.menuInstall' },
		{ icon: 'check', text: 'settings.install.confirm' }
	];
	const STEPS: Record<NonNullable<InstallRoute>, Step[]> = {
		prompt: [],
		'ios-safari': SAFARI,
		'ios-in-app': SAFARI,
		'ios-browser': IOS_BROWSER,
		'android-menu': ANDROID,
		'android-in-app': ANDROID
	};

	// A step's text never takes values, as in the menu's labels.
	const text = (key: MessageKey): string => (t as (key: MessageKey) => string)(key);
	const route = $derived(installApp.route);
	const steps = $derived(route ? STEPS[route] : []);
	const inApp = $derived(route === 'ios-in-app' || route === 'android-in-app' ? route : null);
	const browserName = $derived(route === 'android-in-app' ? 'Chrome' : 'Safari');
	const homeScreen = $derived(route?.startsWith('ios') ?? false);
	const host = $derived(
		text(`settings.install.host.${inAppHost(navigator.userAgent) ?? 'other'}` as MessageKey)
	);
	// This page's address, read when the dialog opens.
	let address = $state('');
	$effect(() => {
		if (installApp.dialog) address = location.href;
	});
</script>

<Dialog bind:open={installApp.dialog} title={t('settings.installApp')}>
	<div class="install" data-testid="install-steps">
		{#if inApp}
			<p>{t('settings.install.inApp', { host, browser: browserName })}</p>
			<div class="actions">
				<Button
					icon="openBrowser"
					variant="accent"
					onclick={() => (location.href = openOutsideLink(inApp, address))}
					>{t('settings.install.open', { browser: browserName })}</Button
				>
				<CopyButton
					labelled
					label={t('share.copy')}
					text={address}
					failed={t('settings.install.copyFailed')}
					hint={null}
				/>
			</div>
			<p>{t('settings.install.then', { browser: browserName })}</p>
		{/if}
		<ol>
			{#each steps as step, i (step.text)}
				<li>
					<span class="n">{i + 1}</span>
					<span class="glyph"><Icon name={step.icon} /></span>
					<span class="text"
						>{text(step.text)}{#if step.detail}<span class="detail">{text(step.detail)}</span
							>{/if}</span
					>
				</li>
			{/each}
		</ol>
		{#if homeScreen}<p>{t('settings.install.done')}</p>{/if}
	</div>
</Dialog>

<style>
	.install {
		display: grid;
		gap: var(--space-3);
	}
	p {
		margin: 0;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	ol {
		display: grid;
		gap: var(--space-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li {
		display: grid;
		grid-template-columns: auto auto 1fr;
		align-items: center;
		gap: var(--space-2);
	}
	.n {
		min-width: 1em;
		color: var(--on-surface-muted);
		font-variant-numeric: tabular-nums;
		text-align: end;
	}
	.glyph {
		display: inline-grid;
		color: var(--accent);
		font-size: 1.25rem;
	}
	.text {
		display: grid;
	}
	.detail {
		color: var(--on-surface-muted);
		font-size: 0.875em;
	}
</style>
