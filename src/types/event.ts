export type EventStatus = 'SOON' | 'OPEN' | 'FINISHED' | 'FULL';

export interface Event {
  id: string;
  tema: string;
  palestrante: string;
  fecha_iso: string;
  opening_date_iso?: string; // New field for opening date
  fecha?: string;
  hora: string;
  link_inscripcion: string;
  tipo_evento: string;
  patrocinio_destacado?: string;
  // Mock quota fields
  quota_crm_max?: number;
  quota_social_max?: number;
  current_crm?: number;
  current_social?: number;
}

export interface EventStatusConfig {
  label: string;
  class: string;
  button: string;
  disabled: boolean;
}
