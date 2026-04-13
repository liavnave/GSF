import type { DataModels } from '@/enums/datasources';

export function getTitleFromDataModelType(type: DataModels): string {
	return String(type).toLowerCase().replace(/_/g, ' ');
}
