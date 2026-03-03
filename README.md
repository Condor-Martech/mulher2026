# Projeto Mulher - Web Landing Page

Este é o repositório da aplicação web para o evento **Mulher**. O projeto consiste em uma landing page moderna e responsiva, desenvolvida para apresentar informações sobre o evento, cronograma (grade de eventos), parceiros e patrocinadores, além de permitir o cadastro de interessados.

## 🚀 Tecnologias Utilizadas

O projeto foi inicializado a partir do boilerplate minimalista do Astro e utiliza as seguintes tecnologias:

- [Astro](https://astro.build/) - Framework web ultra-veloz focado no conteúdo.
- [React](https://reactjs.org/) - Biblioteca para criação de interfaces de usuário (componentes e formulários dinâmicos).
- [Tailwind CSS v4](https://tailwindcss.com/) - Framework CSS para construção rápida de layouts customizados e responsivos.

## 📁 Estrutura do Projeto

Abaixo uma visão geral da estrutura de diretórios e seu propósito no ecossistema Astro:

```text
/
├── public/           # Arquivos estáticos disponibilizados diretamente na raiz do servidor (ex: favicon, imagens estáticas).
├── src/
│   ├── assets/       # Arquivos processados pelo bundler do Astro (arquivos de mídia, fontes, etc).
│   ├── components/   # Componentes visuais do projeto (Hero, Partners, EventGrid, BannerCasa, Form, etc).
│   ├── data/         # Arquivos de dados estáticos ou estáticos em JSON/TS usados no projeto.
│   ├── layouts/      # Layouts gerais da página e estruturas comuns de container.
│   ├── pages/        # Rotas da aplicação, index.astro atua como a página principal "Home".
│   ├── services/     # Serviços de integração como envio de formulários para planilhas.
│   ├── styles/       # Arquivo global CSS e definições de padrões do Tailwind.
│   └── types/        # Definições globais de tipagem em TypeScript.
└── package.json      # Dependências e organização dos scripts NPM.
```

## 🧞 Scripts de Desenvolvimento

Todos os comandos NPM devem ser rodados a partir da raiz principal do projeto, via terminal:

| Comando                   | Ação                                                                   |
| :------------------------ | :--------------------------------------------------------------------- |
| `npm install`             | Instala as dependências necessárias.                                   |
| `npm run dev`             | Inicia o servidor local de testes no endereço padrão `localhost:4321`. |
| `npm run build`           | Compila e otimiza sua página para produção no diretório `./dist/`.     |
| `npm run preview`         | Testa a versão local de produção antes do deploy.                      |
| `npm run astro -- --help` | Obtenha ajuda e veja os vários comandos internos na ferramenta da CLI. |

## 📌 Funcionalidades Principais

Entre as principais funcionalidades implementadas neste repositório destacam-se:

- **Formulários de Captação Avançados:** Com validação estrita (ex: suporte nativo para validação de CPF) de botões de chamada dinâmicos (CTA).
- **Design Web Responsivo:** Adequação aos dispositivos móveis através do uso avançado de flexbox/grid no Tailwind, incluindo o scroll interativo para componentes e logs de Parceiros e sessões do Carrossel.
- **Grade de Apresentações:** O `EventGrid` lista horários chave da conferência em um design assimétrico exclusivo com priorização de inscrições abertas.
- **Animações Fluidas:** Melhoria contínua da experiência web (UX) através de keyframes customizados que dão suavidade para modais, banners e carrosséis.

---

_Gerado com as melhores práticas de documentação open-source._
