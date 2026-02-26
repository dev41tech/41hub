# Runbook: Base de Conhecimento (Knowledge Base)

## Overview
The Knowledge Base (KB) allows admins to create articles linked to ticket categories. When users open a new ticket and select a category, related KB articles are suggested to help deflect unnecessary tickets.

## Access
- **Admin UI**: `/admin/kb` (create/edit/delete articles)
- **User-facing**: KB suggestions appear on `/tickets/new` when a category is selected
- **Permission**: All authenticated users can read published articles; admins manage articles

## API Endpoints

### User Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/kb?categoryId=&q=` | List published articles (filter by category and/or search query) |
| GET | `/api/kb/:id` | Get article detail + log view |
| POST | `/api/kb/:id/feedback` | Submit feedback `{ helpful: boolean }` |

### Admin Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/kb` | List all articles (including unpublished) |
| POST | `/api/admin/kb` | Create article `{ title, body, categoryId, isPublished }` |
| PATCH | `/api/admin/kb/:id` | Update article fields |
| DELETE | `/api/admin/kb/:id` | Hard-delete article |

## Article Structure
```json
{
  "id": "uuid",
  "title": "Como configurar VPN",
  "body": "## Passo 1\n...",
  "categoryId": "uuid-of-category",
  "isPublished": true,
  "createdBy": "user-uuid",
  "updatedBy": "user-uuid",
  "createdAt": "2026-02-25T...",
  "updatedAt": "2026-02-25T...",
  "viewCount": 42,
  "helpfulCount": 30,
  "notHelpfulCount": 5,
  "categoryName": "Infraestrutura"
}
```

## How Ticket Suggestion Works

1. User navigates to `/tickets/new`
2. User selects a ticket category
3. Frontend queries `GET /api/kb?categoryId=<selected>` 
4. Up to 3 published articles are shown in a highlighted suggestion card
5. User can click an article to read it (opens in new tab or inline)
6. If the article solves their issue, they can cancel ticket creation

## Validation Steps

1. **Create an article**: Go to `/admin/kb`, click "Novo Artigo", fill title/body/category, save
2. **Verify listing**: Article appears in admin list with correct category
3. **Test suggestion**: Go to `/tickets/new`, select the same category, verify the article appears in suggestions
4. **Test feedback**: Open an article, click thumbs up/down, verify count updates
5. **Test unpublish**: Toggle article to unpublished, verify it no longer appears in suggestions

## Troubleshooting
- Articles only appear in ticket suggestions if they are published (`isPublished: true`)
- Articles require a `categoryId` to appear as suggestions
- Views are logged each time `GET /api/kb/:id` is called (per user visit)
- Feedback is unique per user per article (one vote, can be changed)
