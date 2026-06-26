export type EventStatus = 'SOON' | 'OPEN' | 'FINISHED' | 'FULL';

export interface Event {
  id: string;
  tema: string;
  palestrante: string;
  data_evento: string;
  data_abertura_inscricao?: string; // When the form opens
  data_limite_inscricao?: string; // Optional deadline
  link_inscripcion: string;
  tipo_evento: string;
  patrocinio_destacado?: string;
  is_active?: boolean;
  campanha_active?: boolean;
  // Mock quota fields
  qtd_crm?: number;
  qtd_social?: number;
  current_crm?: number;
  current_social?: number;
  // Sabores de Inverno: metadatos de sede/marca (JSONB `data`).
  data?: Record<string, any> | null;
  region?: string;
  location?: string;
  brand?: string;
  sponsor?: string;
  time_label?: string;
}

export interface EventStatusConfig {
  label: string;
  class: string;
  button: string;
  disabled: boolean;
}
