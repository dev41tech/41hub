# Runbook - Chamados (Tickets)

## Setup

```bash
npm run db:push
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `TICKETS_TARGET_SECTOR_NAME` | `Tech` | Nome do setor de destino para chamados |

## Endpoints de Teste

### Listar categorias (autenticado)
```bash
curl -b cookies.txt http://localhost:5000/api/tickets/categories
```

### Criar ticket (Admin/Coordenador)
```bash
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  http://localhost:5000/api/tickets \
  -d '{
    "title": "Problema com VPN",
    "description": "Não consigo conectar na VPN desde hoje cedo",
    "requesterSectorId": "<SECTOR_ID>",
    "categoryId": "<CATEGORY_ID>",
    "priority": "ALTA"
  }'
```

### Listar tickets
```bash
curl -b cookies.txt "http://localhost:5000/api/tickets"
curl -b cookies.txt "http://localhost:5000/api/tickets?includeClosed=true"
curl -b cookies.txt "http://localhost:5000/api/tickets?q=vpn"
```

### Detalhe do ticket
```bash
curl -b cookies.txt http://localhost:5000/api/tickets/<TICKET_ID>
```

### Atualizar ticket (Admin)
```bash
curl -X PATCH -b cookies.txt -H "Content-Type: application/json" \
  http://localhost:5000/api/tickets/<TICKET_ID> \
  -d '{"status": "EM_ANDAMENTO", "priority": "URGENTE"}'
```

### Atribuir responsaveis (Admin)
```bash
curl -X PUT -b cookies.txt -H "Content-Type: application/json" \
  http://localhost:5000/api/tickets/<TICKET_ID>/assignees \
  -d '{"assigneeIds": ["<USER_ID_1>", "<USER_ID_2>"]}'
```

### Comentar (Admin sempre; User/Coord apenas se status AGUARDANDO_USUARIO)
```bash
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  http://localhost:5000/api/tickets/<TICKET_ID>/comments \
  -d '{"body": "Estamos verificando o problema.", "isInternal": false}'
```

### Anexar arquivo
```bash
curl -X POST -b cookies.txt \
  -F "file=@screenshot.png" \
  http://localhost:5000/api/tickets/<TICKET_ID>/attachments
```

### Download de anexo
```bash
curl -b cookies.txt -o file.pdf \
  http://localhost:5000/api/tickets/<TICKET_ID>/attachments/<ATTACHMENT_ID>/download
```

## Admin - Categorias

```bash
# Listar
curl -b cookies.txt http://localhost:5000/api/admin/tickets/categories

# Criar subcategoria
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  http://localhost:5000/api/admin/tickets/categories \
  -d '{"name": "Rede Wi-Fi", "branch": "INFRA", "parentId": "<ROOT_INFRA_ID>"}'

# Desativar
curl -X DELETE -b cookies.txt http://localhost:5000/api/admin/tickets/categories/<ID>
```

## Admin - SLA Policies

```bash
# Listar
curl -b cookies.txt http://localhost:5000/api/admin/tickets/sla-policies

# Criar
curl -X POST -b cookies.txt -H "Content-Type: application/json" \
  http://localhost:5000/api/admin/tickets/sla-policies \
  -d '{"name": "Custom SLA", "priority": "ALTA", "firstResponseMinutes": 120, "resolutionMinutes": 720}'

# Atualizar
curl -X PATCH -b cookies.txt -H "Content-Type: application/json" \
  http://localhost:5000/api/admin/tickets/sla-policies/<ID> \
  -d '{"resolutionMinutes": 960}'
```

## Checklist de Permissao

| Acao | Admin | Coordenador | Usuario |
|---|---|---|---|
| Ver tickets do proprio setor | Todos | Setores que coordena + proprios | Setores que pertence |
| Criar ticket | Qualquer setor | Setores que coordena | Nao |
| Editar status/prioridade/categoria | Sim | Nao | Nao |
| Atribuir responsaveis | Sim | Nao | Nao |
| Comentar (sempre) | Sim | Nao | Nao |
| Comentar (AGUARDANDO_USUARIO) | Sim | Sim | Sim |
| Comentario interno | Sim | Nao | Nao |
| Ver comentarios internos | Sim | Nao | Nao |
| Upload anexo (sempre) | Sim | Nao | Nao |
| Upload anexo (AGUARDANDO_USUARIO) | Sim | Sim | Sim |
| Download anexo | Se tem acesso ao ticket | Se tem acesso ao ticket | Se tem acesso ao ticket |
| CRUD categorias | Sim | Nao | Nao |
| CRUD SLA policies | Sim | Nao | Nao |

## SLA - Horarios Uteis

- Seg-Qui: 08:00-18:00
- Sexta: 08:00-17:00
- Sabado/Domingo: Fechado
- Timezone: America/Sao_Paulo (UTC-03 fixo no MVP)

## SLA Fallback (se nao houver policy configurada)

| Prioridade | Primeira Resposta | Resolucao |
|---|---|---|
| URGENTE | 60 min | 480 min (1 dia util) |
| ALTA | 240 min | 1440 min (3 dias uteis) |
| MEDIA | 480 min | 4320 min (9 dias uteis) |
| BAIXA | 1440 min | 10080 min (21 dias uteis) |
