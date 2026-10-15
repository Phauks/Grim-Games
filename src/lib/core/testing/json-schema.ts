/**
 * Test helper: a small JSON Schema validator covering the keywords TPI's
 * `script-schema.json` uses (type, enum, pattern, maxLength, minItems, maxItems, required,
 * properties, additionalProperties: false, items, oneOf). Annotation keywords (title,
 * examples, format, deprecated, default) are ignored. Written here to avoid a dependency;
 * `script-tool.test.ts` checks it rejects what it should.
 */
type Schema = Record<string, unknown>;

function typeOf(value: unknown): string {
	if (value === null) return 'null';
	if (Array.isArray(value)) return 'array';
	if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
	return typeof value;
}

function matchesType(value: unknown, type: string): boolean {
	const actual = typeOf(value);
	return actual === type || (type === 'number' && actual === 'integer');
}

/** Returns a list of problems; empty when `value` is valid against `schema`. */
export function validateJsonSchema(schema: Schema, value: unknown, path = '$'): string[] {
	const errors: string[] = [];
	if (typeof schema.type === 'string' && !matchesType(value, schema.type)) {
		return [`${path}: expected ${schema.type}, got ${typeOf(value)}`];
	}
	if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
		errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
	}
	if (typeof value === 'string') {
		if (typeof schema.maxLength === 'number' && [...value].length > schema.maxLength) {
			errors.push(`${path}: longer than ${schema.maxLength}`);
		}
		if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern, 'u').test(value)) {
			errors.push(`${path}: does not match ${schema.pattern}`);
		}
	}
	if (Array.isArray(value)) {
		if (typeof schema.minItems === 'number' && value.length < schema.minItems) {
			errors.push(`${path}: fewer than ${schema.minItems} items`);
		}
		if (typeof schema.maxItems === 'number' && value.length > schema.maxItems) {
			errors.push(`${path}: more than ${schema.maxItems} items`);
		}
		if (schema.items && typeof schema.items === 'object') {
			value.forEach((item, i) =>
				errors.push(...validateJsonSchema(schema.items as Schema, item, `${path}[${i}]`))
			);
		}
	}
	if (typeOf(value) === 'object') {
		const obj = value as Record<string, unknown>;
		const props = (schema.properties ?? {}) as Record<string, Schema>;
		for (const key of (schema.required as string[] | undefined) ?? []) {
			if (!(key in obj)) errors.push(`${path}: missing ${key}`);
		}
		for (const [key, child] of Object.entries(obj)) {
			if (props[key]) errors.push(...validateJsonSchema(props[key], child, `${path}.${key}`));
			else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not allowed`);
		}
	}
	if (Array.isArray(schema.oneOf)) {
		const passing = (schema.oneOf as Schema[]).filter(
			(s) => validateJsonSchema(s, value, path).length === 0
		);
		if (passing.length !== 1) {
			errors.push(`${path}: matches ${passing.length} of the oneOf schemas, expected exactly 1`);
		}
	}
	return errors;
}
