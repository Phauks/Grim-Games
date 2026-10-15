import { describe, expect, it } from 'vitest';
import type { Component } from 'svelte';
import { registerSettingsSection, settingsSections } from './registry.ts';

const component = (() => {}) as unknown as Component;

describe('settings section registry', () => {
	it('orders sections and replaces a section registered twice', () => {
		registerSettingsSection({
			id: 'b',
			label: 'B',
			icon: 'info',
			component,
			audience: 'everyone',
			order: 20
		});
		registerSettingsSection({
			id: 'a',
			label: 'A',
			icon: 'info',
			component,
			audience: 'everyone',
			order: 10
		});
		registerSettingsSection({
			id: 'b',
			label: 'B2',
			icon: 'info',
			component,
			audience: 'everyone',
			order: 5
		});
		expect(settingsSections().map((s) => s.label)).toEqual(['B2', 'A']);
	});
});
