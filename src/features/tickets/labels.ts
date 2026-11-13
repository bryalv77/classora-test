import type { components } from '@/shared/api/schema';

// considerar usar i18n
export const STATE_LABELS: Record<components['schemas']['TicketStateFilter'], string> = {
  ALL: 'Todos',
  REPORTED: 'Reportado',
  IN_PROGRESS: 'En curso',
  PENDING_SECURITY: 'Pendiente de seguridad',
  DONE: 'Hecho',
};

export const SEVERITY_LABELS: Record<components['schemas']['SeverityFilter'], string> = {
  ALL: 'Todas',
  CRITICAL: 'Crítica',
  HIGH: 'Alta',
  MEDIUM: 'Media',
  LOW: 'Baja',
};

export const SORT_LABELS: Record<components['schemas']['TicketSortField'], string> = {
  KEY: 'Clave',
  ASSET: 'Asset',
  SEVERITY: 'Severidad',
  STATE: 'Estado',
  TARGET_DATE: 'F. objetivo',
  DUE_DATE: 'Compromiso',
  LAST_MODIFIED: 'Última mod.',
};
