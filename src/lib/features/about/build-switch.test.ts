import { describe, expect, it } from 'vitest';
import { buildSwitch } from './build-switch.ts';

const at = (href: string) => new URL(href);

describe('switching between beta and production', () => {
	it('opens the same page on beta from production', () => {
		expect(
			buildSwitch({ channel: 'production' }, at('https://grimbinder.com/library?x=1#y'))
		).toEqual({
			to: 'beta',
			href: 'https://beta.grimbinder.com/library'
		});
	});

	it('opens the same page on production from beta', () => {
		expect(buildSwitch({ channel: 'preview' }, at('https://beta.grimbinder.com/settings'))).toEqual(
			{
				to: 'production',
				href: 'https://grimbinder.com/settings'
			}
		);
	});

	it('opens production from any other preview, including a single deployment', () => {
		expect(buildSwitch({ channel: 'preview' }, at('https://claude-x.grimbinder.com/'))?.href).toBe(
			'https://grimbinder.com/'
		);
		expect(buildSwitch({ channel: 'preview' }, at('https://8387f394.grimbinder.com/a'))?.href).toBe(
			'https://grimbinder.com/a'
		);
	});

	it('has no other build to open locally', () => {
		expect(buildSwitch({ channel: 'local' }, at('http://localhost:8787/'))).toBeUndefined();
		expect(buildSwitch({ channel: 'preview' }, at('http://localhost:8787/'))).toBeUndefined();
	});
});
