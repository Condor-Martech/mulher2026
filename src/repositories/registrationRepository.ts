import { supabase } from '../lib/supabase';

export interface RegistrationData {
  p_event_id: string;
  p_nome: string;
  p_email: string;
  p_cpf: string;
  p_telefone: string;
  p_source: string;
  p_tema?: string;
  p_opening_date?: string | null;
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
}

export interface RegistrationCount {
  event_id: string;
  source: string;
}

export const registrationRepository = {
  /**
   * Calls the Supabase RPC to register a participant.
   */
  async registerParticipant(data: RegistrationData): Promise<RegistrationResult> {
    const { data: rpcData, error } = await supabase.rpc('inscrever_participante', data);
    
    if (error) {
      console.error('Supabase RPC Error:', error);
      throw error;
    }
    
    return rpcData as RegistrationResult;
  },

  /**
   * Fetches the registration counts from Supabase.
   */
  async fetchRegistrationCounts(): Promise<RegistrationCount[]> {
    const { data, error } = await supabase
      .from('inscricoes')
      .select('event_id, source');

    if (error) {
      console.error('Supabase Fetch Error:', error);
      throw error;
    }

    return data as RegistrationCount[];
  }
};
