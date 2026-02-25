# 41 Hub

## 🎯 Visão Geral

O 41 Hub é uma solução de portal corporativo desenvolvida para centralizar o ecossistema de ferramentas internas de uma organização. O sistema resolve a fragmentação de acesso a aplicações e dados, atuando como um *Single Point of Entry* (Ponto Único de Entrada).

O diferencial arquitetural do projeto reside no seu sistema robusto de **RBAC (Role-Based Access Control)**, garantindo que a visibilidade de aplicativos e dashboards analíticos seja dinamicamente renderizada com base no Time (Squad) e Cargo (Role) do colaborador autenticado.

## ✨ Funcionalidades Key

### 🛡️ Gestão de Identidade e Acesso
* **Segregação Lógica de Dados:** Estrutura de banco de dados relacional desenhada para isolar contextos de times.
* **Permissões Granulares:** O *Frontend* reage às *Claims* do usuário, ocultando ou exibindo módulos sensíveis.

### 📊 Dashboards e Analytics
* Visualização de dados integrada diretamente no portal.

### 🎨 UX/UI e Personalização
* **Theme Engine:** Suporte nativo a temas (Dark/Light Mode) persistidos via **LocalStorage**.
* **Gestão de Perfil:** Upload e crop de imagem de perfil com armazenamento em **Pasta local**.

### 🤝 Integração de Comunicação (WhatsApp)
* **Direct Connect:** Funcionalidade que mapeia o número corporativo do colaborador e gera *Deep Links* dinâmicos (`wa.me`).
* Permite iniciar conversas de trabalho com um clique, sem necessidade de salvar contatos na agenda pessoal, agilizando a comunicação intra-equipes.

## 💻 Tech Stack

A arquitetura foi pensada para escalabilidade e manutenção:

**Frontend:**
* **Core:** React.js com TypeScript / Vite
* **Estilização:** Tailwind CSS

**Backend:**
* **API:** Node.js (Express)
* **Database:** PostgreSQL

**DevOps & Tools:**
* **Controle de Versão:** Git & GitHub
* **Containerização:** Docker

## 🗄️ Modelagem de Dados (Resumo)

O sistema baseia-se em três entidades principais para o controle de acesso:
1.  **Users:** Dados cadastrais e preferências.
2.  **Roles:** Definição de níveis de acesso (Admin, Coordenador, Usuário).
3.  **Squads:** Agrupamento lógico de times para distribuição de Dashboards e aplicativos.
