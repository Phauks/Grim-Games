import { REFERENCE_FIELDS, type FieldId } from './fields.ts';

/** Fields the table view renders, one column each, in list order. */
export function tableFieldIds(): FieldId[] {
	return REFERENCE_FIELDS.map((f) => f.id);
}
