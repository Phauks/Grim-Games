import { describe, expect, expectTypeOf, it } from 'vitest';
import {
	anyOf,
	byToken,
	COUNT,
	list,
	NUM,
	obj,
	oneOf,
	opt,
	STR,
	T,
	TOKEN,
	TOKENS,
	variants,
	type SpecValue
} from './field-spec.ts';
import { readSpec } from './read-spec.ts';
import type { ReminderLabel } from './types.ts';
import { Issues } from './validate.ts';

const REMINDERS = ['Drunk', 'Poisoned'];

function readAs(spec: Parameters<typeof readSpec>[0], raw: unknown) {
	const issues = new Issues();
	const value = readSpec(spec, raw, 'x', issues, REMINDERS);
	return { value, issues: issues.list };
}

describe('readSpec', () => {
	it('reads a value of the spec’s shape as it is', () => {
		const spec = obj({ tokens: TOKENS, at: oneOf(['dawn', 'dusk']), replaces: opt(T) });
		expect(readAs(spec, { tokens: ['Drunk'], at: 'dusk', replaces: true })).toEqual({
			value: { tokens: ['Drunk'], at: 'dusk', replaces: true },
			issues: []
		});
	});

	it('reads an optional setting left out as absent, and an on-only setting set to false as a slip', () => {
		const spec = obj({ token: TOKEN, replaces: opt(T) });
		expect(readAs(spec, { token: 'Drunk' }).value).toEqual({ token: 'Drunk' });
		expect(readAs(spec, { token: 'Drunk', replaces: false }).issues).toEqual([
			'x.replaces: expected true'
		]);
	});

	it('records each problem under its path and reads nothing', () => {
		const spec = obj({ token: TOKEN, count: COUNT, at: oneOf(['dawn']), also: opt(NUM) });
		expect(readAs(spec, { token: 'Mad', count: 0, at: 'noon', extra: 1 })).toEqual({
			value: undefined,
			issues: [
				'x.extra: unknown field',
				'x.token: not one of this character’s reminders',
				'x.count: expected a whole number above 0, got 0',
				'x.at: unknown value "noon"'
			]
		});
		expect(readAs(obj({ token: TOKEN }), {}).issues).toEqual(['x.token: missing']);
		expect(readAs(obj({ token: TOKEN }), 'Drunk').issues).toEqual([
			'x: expected object, got string'
		]);
	});

	it('checks lists, reminders as keys and lists of choices', () => {
		expect(readAs(TOKENS, ['Drunk', 'Mad']).issues).toEqual([
			'x: not this character’s reminders: Mad'
		]);
		expect(readAs(list(STR), ['a', 2]).issues).toEqual(['x[1]: expected string, got number']);
		expect(readAs(byToken(STR), { Drunk: 'a', Mad: 'b' }).issues).toEqual([
			'x.Mad: not one of this character’s reminders'
		]);
		expect(readAs(anyOf(['a', 'b']), ['a', 'c']).issues).toEqual(['x[1]: unknown value "c"']);
	});

	it('reads the variant the value is, and names them when none fits', () => {
		const spec = variants(
			{ label: 'Count', is: 'number', spec: COUNT },
			{ label: 'Reminder', has: 'token', spec: obj({ token: TOKEN }) }
		);
		expect(readAs(spec, 2).value).toBe(2);
		expect(readAs(spec, { token: 'Drunk' }).value).toEqual({ token: 'Drunk' });
		expect(readAs(spec, 'two').issues).toEqual(['x: expected one of: count, reminder']);
	});

	it('gives the value the spec’s type', () => {
		const spec = obj({
			tokens: TOKENS,
			at: oneOf(['dawn', 'dusk']),
			replaces: opt(T),
			by: variants({ label: 'Count', is: 'number', spec: COUNT }, { label: 'Text', spec: STR })
		});
		expectTypeOf<SpecValue<typeof spec>>().toEqualTypeOf<{
			tokens: readonly ReminderLabel[];
			at: 'dawn' | 'dusk';
			replaces?: true;
			by: number | string;
		}>();
		expect(spec.kind).toBe('object');
	});
});
