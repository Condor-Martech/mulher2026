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
}

export interface EventStatusConfig {
  label: string;
  class: string;
  button: string;
  disabled: boolean;
}
