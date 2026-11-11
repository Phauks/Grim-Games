/**
 * The format guide's sections, drawn from the setup specs (`setup-spec.ts`): each section's
 * fields and kinds, with their wording, whether they are required and the values they take.
 * The guide on Add mode, its export and the Mode builder's form all read these.
 */
import type { FieldSpec, ObjectField } from '#lib/core/data/field-spec.ts';
import { IDS, SEATED, TYPES, type GuideField, type GuideSection } from './guide-fields.ts';
import { SETUP_SPECS } from './setup-spec.ts';
import type { FileSection } from './types.ts';

/** Fields every section has, which the guide describes once (`CITE`, `INSTRUCTIONS`). */
const SHARED = new Set(['kind', 'cite', 'instructions']);

/** How a value is written, in the guide's words. */
export function typeText(spec: FieldSpec): string {
	switch (spec.kind) {
		case 'true':
		case 'boolean':
			return 'true or false';
		case 'count':
		case 'number':
		case 'integer':
			return 'whole number';
		case 'character':
			return 'character id';
		case 'enums': {
			const types: readonly string[] = TYPES;
			return spec.values.every((v) => types.includes(v))
				? 'list of character types'
				: 'list of text';
		}
		case 'strings':
			return 'list of text';
		case 'numbers':
			return 'list of whole numbers';
		case 'list': {
			const of = spec.of;
			if (of.kind === 'character') return IDS;
			if (of.kind === 'list' && of.of.kind === 'character') return 'list of lists of character ids';
			if (of.kind === 'count' || of.kind === 'number' || of.kind === 'integer')
				return 'list of whole numbers';
			if (of.kind === 'object' && keys(of) === 'title, url') return 'list of links';
			if (of.kind === 'object') return `list of { ${keys(of)} }`;
			return `list of ${typeText(of)}`;
		}
		case 'object': {
			const seated: readonly string[] = SEATED;
			if (spec.fields.every((f) => seated.includes(f.key))) return 'object of counts by type';
			return `{ ${keys(spec)} }`;
		}
		default:
			return 'text';
	}
}

const keys = (spec: Extract<FieldSpec, { kind: 'object' }>) =>
	spec.fields.map((f) => f.key).join(', ');

function guideField(field: ObjectField): GuideField {
	const values =
		field.spec.kind === 'enum' || field.spec.kind === 'enums' ? field.spec.values : undefined;
	return {
		name: field.key,
		type: typeText(field.spec),
		required: !field.optional,
		about: field.spec.about ?? '',
		...(values ? { values } : {})
	};
}

const ownFields = (spec: FieldSpec): GuideField[] =>
	spec.kind === 'object' ? spec.fields.filter((f) => !SHARED.has(f.key)).map(guideField) : [];

/** One section of the guide, from its spec. */
export function guideSection(section: FileSection): GuideSection {
	const spec: FieldSpec = SETUP_SPECS[section];
	const list = spec.kind === 'list' || spec.kind === 'strings';
	const item = spec.kind === 'list' ? spec.of : spec;
	const kinds =
		item.kind === 'variants'
			? item.variants.map((v) => ({
					kind: v.tag ?? v.label,
					about: v.spec.about ?? '',
					fields: ownFields(v.spec)
				}))
			: [];
	return { part: section, list, about: spec.about ?? '', fields: ownFields(item), kinds };
}
