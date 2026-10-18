import type { ColumnFilter } from '#lib/ui/table/column-filter.ts';
import type { FieldId } from './fields.ts';

/**
 * What the Reference page is showing: its search, the table's own column filters and how many
 * rows those leave. Shared by the controls in the page's title row and the list under it.
 */
export class ReferenceQuery {
	search = $state('');
	columnFilters = $state<Partial<Record<FieldId, ColumnFilter>>>({});
	tableShown = $state(0);
}
