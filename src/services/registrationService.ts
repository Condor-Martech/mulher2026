import { registrationRepository, type RegistrationData, type RegistrationResult } from '../repositories/registrationRepository';

export const registrationService = {
  /**
   * Handles the registration process including retries and data normalization.
   */
  async submitRegistration(
    formData: Record<string, any>,
    source: string
  ): Promise<RegistrationResult> {
    const registrationData: RegistrationData = {
      p_event_id: formData.eventId,
      p_nome: formData.nome,
      p_email: formData.email,
      p_cpf: (formData.cpf as string).replace(/\D/g, ''),
      p_telefone: formData.telefone,
      p_source: source,
      p_tema: ''
    };

    const performRegistration = async (retryCount = 0): Promise<RegistrationResult> => {
      try {
        return await registrationRepository.registerParticipant(registrationData);
      } catch (err) {
        if (retryCount < 1) { // 1 automatic retry as per requirement
          console.warn(`Retrying registration... (${retryCount + 1})`);
          return performRegistration(retryCount + 1);
        }
        throw err;
      }
    };

    return performRegistration();
  }
};
