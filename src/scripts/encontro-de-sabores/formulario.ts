/**
 * Formulário de inscrição do Encontro de Sabores Condor.
 *
 * Segue o padrão do repo (utils/formHandler.ts, utils/saboresCrmForm.ts):
 * validação no cliente + máscaras + envio pelo serviço compartilhado.
 *
 * DIFERENÇA DELIBERADA EM RELAÇÃO AO formHandler.ts: aqui o CPF é validado de
 * verdade. O do repo só confere se há 11 dígitos, então `00000000000` passa.
 * O briefing pede «validação de CPF», que no Brasil significa os dígitos
 * verificadores. A função está mais abaixo e é a única lógica nova deste arquivo.
 *
 * A validação no cliente é CONVENIÊNCIA DE UX. Quem decide de verdade é a
 * RPC `inscrever_participante`, que confere a cota e a unicidade do CPF de
 * forma transacional. Sem isso, dois envios simultâneos com uma vaga livre
 * poderiam entrar os dois.
 */
import { registrationService } from "../../services/registrationService";
import content from "../../data/encontro-de-sabores/content.json";

type Validador = (valor: string, el: HTMLInputElement) => boolean;

/** Dígitos verificadores do CPF. Rejeita também os onze dígitos repetidos,
 *  que passam no cálculo mas não são CPF válidos (000…, 111…, 999…). */
export function cpfValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (hasta: number): number => {
    let suma = 0;
    for (let i = 0; i < hasta; i++) suma += Number(cpf[i]) * (hasta + 1 - i);
    const resto = (suma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(cpf[9]) && digito(10) === Number(cpf[10]);
}

/** Celular brasileiro: 10 ou 11 dígitos e DDD real (11–99, sem os não atribuídos). */
export function telefoneValido(valor: string): boolean {
  const tel = valor.replace(/\D/g, "");
  if (tel.length !== 10 && tel.length !== 11) return false;
  const ddd = Number(tel.slice(0, 2));
  const DDD_VALIDOS = [
    11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35,
    37, 38, 41, 42, 43, 44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64,
    65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81, 82, 83, 84, 85, 86, 87, 88,
    89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  ];
  if (!DDD_VALIDOS.includes(ddd)) return false;
  // Com 11 dígitos, o celular começa por 9.
  if (tel.length === 11 && tel[2] !== "9") return false;
  return true;
}

const VALIDADORES: Record<string, Validador> = {
  nome: (v) => v.trim().length > 2 && v.trim().includes(" "),
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()),
  cpf: (v) => cpfValido(v),
  telefone: (v) => telefoneValido(v),
  maioridade: (_v, el) => el.checked,
  restricao: (_v, el) => el.checked,
  lgpd: (_v, el) => el.checked,
};

const MENSAGENS: Record<string, string> = content.formulario.erros;

function mascaraCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

function mascaraTelefone(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return d.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

/**
 * Modal da LP web. Padrão do repo: <dialog> nativo, o Esc fecha de graça e o
 * clique fora do quadro também (compara-se o ponto com o rect do diálogo,
 * porque o <dialog> ocupa a tela inteira e o ::backdrop não recebe cliques).
 */
export function montarModalInscricao(): void {
  const modal = document.querySelector<HTMLDialogElement>("#encontro-modal");
  if (!modal) return;

  for (const disparador of document.querySelectorAll<HTMLElement>("[data-abre-inscricao]")) {
    disparador.addEventListener("click", (ev) => {
      ev.preventDefault();
      modal.showModal();
      modal.querySelector<HTMLInputElement>("input, button")?.focus();
    });
  }
  for (const cerrar of modal.querySelectorAll<HTMLElement>("[data-fecha-inscricao]")) {
    cerrar.addEventListener("click", () => modal.close());
  }
  modal.addEventListener("click", (ev) => {
    const r = modal.getBoundingClientRect();
    const fuera =
      ev.clientX < r.left || ev.clientX > r.right ||
      ev.clientY < r.top || ev.clientY > r.bottom;
    if (fuera) modal.close();
  });

  montarFormulario();
}

export function montarFormulario(): void {
  const form = document.querySelector<HTMLFormElement>("#form-inscricao");
  if (!form) return;

  const aviso = document.querySelector<HTMLElement>("#form-aviso");
  const boton = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const campos = [...form.querySelectorAll<HTMLInputElement>("[name]")];
  let enviando = false;

  const errorDe = (el: HTMLInputElement) =>
    document.getElementById(`erro-${el.name}`);

  const validar = (el: HTMLInputElement, mostrar = true): boolean => {
    const fn = VALIDADORES[el.name];
    if (!fn) return true;
    const ok = fn(el.value, el);
    const err = errorDe(el);
    if (mostrar && err) {
      err.textContent = ok ? "" : MENSAGENS[el.name] ?? content.formulario.erros.generico;
      el.setAttribute("aria-invalid", ok ? "false" : "true");
    }
    return ok;
  };

  for (const el of campos) {
    // Só avisa depois que o campo é abandonado pela primeira vez: marcar em
    // vermelho enquanto a primeira letra está sendo digitada é hostil.
    el.addEventListener("blur", () => {
      el.dataset.tocado = "true";
      validar(el);
    });
    el.addEventListener("input", () => {
      if (el.name === "cpf") el.value = mascaraCpf(el.value);
      if (el.name === "telefone") el.value = mascaraTelefone(el.value);
      if (el.dataset.tocado === "true") validar(el);
    });
    if (el.type === "checkbox") el.addEventListener("change", () => validar(el));
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (enviando) return; // envio duplo

    const invalidos = campos.filter((el) => !validar(el));
    if (invalidos.length) {
      invalidos[0].focus();
      if (aviso) {
        aviso.textContent = content.formulario.erros.formulario;
        aviso.dataset.tipo = "erro";
      }
      return;
    }

    enviando = true;
    if (boton) {
      boton.disabled = true;
      boton.dataset.textoOriginal = boton.textContent ?? "";
      boton.textContent = content.formulario.enviando;
    }
    if (aviso) {
      aviso.textContent = "";
      delete aviso.dataset.tipo;
    }

    const datos = Object.fromEntries(new FormData(form).entries());
    try {
      // O canal é declarado pelo próprio formulário:
      //   a LP web   → social  (cota qtd_social, as 15 vagas da LP)
      //   o CRM      → crm     (cota qtd_crm, as outras 15)
      // É a mesma resolução que maes e sabores usam (utils/eventStatus.ts).
      // ATENÇÃO — os três aceites NÃO chegam ao banco hoje.
      // registrationService monta um payload fixo (p_nome, p_email, p_cpf,
      // p_telefone, p_source, p_tema, p_nome_filho, p_cpf_filho,
      // p_maioridade_filho) e `maioridade`, `restricao` e `lgpd` não estão
      // nele — `p_maioridade_filho` lê outra chave, e é o campo do Mães sobre
      // a maioridade do filho, não este. Ou seja: o participante marca as três
      // caixas, o navegador valida, e o consentimento se perde.
      // Isso é um problema de LGPD, não um detalhe: coletamos CPF, e-mail e
      // telefone e não guardamos o aceite. Resolver exige aceitar parâmetros
      // novos na RPC `inscrever_participante` (migração) ou gravar o aceite
      // por outro caminho.
      const res = await registrationService.submitRegistration(
        { ...datos, eventId: form.dataset.eventId ?? "" },
        form.dataset.source === "crm" ? "crm" : "social",
      );
      if (res.success) {
        form.hidden = true;
        const exito = document.querySelector<HTMLElement>("#form-sucesso");
        if (exito) {
          exito.hidden = false;
          exito.focus();
        }
        return;
      }
      // Erros de negócio que a RPC devolve.
      const motivo = String(res.error ?? "");
      if (aviso) {
        aviso.textContent = /duplic|already|CPF/i.test(motivo)
          ? content.formulario.erros.cpfDuplicado
          : /full|esgotad|lotad/i.test(motivo)
            ? content.formulario.erros.esgotado
            : content.formulario.erros.envio;
        aviso.dataset.tipo = "erro";
      }
    } catch {
      if (aviso) {
        aviso.textContent = content.formulario.erros.envio;
        aviso.dataset.tipo = "erro";
      }
    } finally {
      enviando = false;
      if (boton) {
        boton.disabled = false;
        boton.textContent = boton.dataset.textoOriginal || content.formulario.enviar;
      }
    }
  });
}
