# Runbook: Teste de Digitacao (Typing Test)

## Overview
The Typing Test feature allows users to test their typing speed (WPM) and accuracy. Results are tracked monthly with sector-based and global leaderboards. Top performers earn badges displayed on their profile.

## Access
- **Test**: `/typing` (all authenticated users)
- **Leaderboard**: `/typing/leaderboard` (all authenticated users)
- **Admin text management**: `/admin/typing` (admin-only)
- **Profile badge**: Displayed on `/profile` automatically

## API Endpoints

### User Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/typing/session` | Start a new typing session (returns text + nonce) |
| POST | `/api/typing/submit` | Submit typed text `{ sessionId, nonce, typedText, durationMs }` |
| GET | `/api/typing/leaderboard?monthKey=YYYY-MM&scope=sector|global&sectorId=` | Get leaderboard |
| GET | `/api/typing/me?monthKey=YYYY-MM` | Get user's best score + position |

### Admin Routes
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/admin/typing/texts` | List all typing texts |
| POST | `/api/admin/typing/texts` | Create text `{ content, language, difficulty }` |
| PATCH | `/api/admin/typing/texts/:id` | Update text fields |
| DELETE | `/api/admin/typing/texts/:id` | Delete text |

## Session Flow

1. User clicks "Iniciar Teste" on `/typing`
2. `POST /api/typing/session` creates a session with:
   - Random active text selected
   - `startedAt` = now
   - `expiresAt` = now + 10 minutes
   - `nonce` = random 32-char string
3. Frontend displays the text and a textarea
4. Timer starts when user types the first character
5. User clicks "Finalizar" which calls `POST /api/typing/submit`

## Score Calculation
- **WPM** = floor((characters typed / 5) / (duration in minutes))
- **Accuracy** = (correct characters / total expected characters) * 100
- Character comparison is position-by-position

## Anti-Cheat Rules
- Session must not be expired (10 minute window)
- Session must not be already submitted
- Nonce must match
- `durationMs` must be >= 20,000ms (20 seconds) and <= 600,000ms (10 minutes)
- WPM > 160 is rejected (humanly impossible sustained speed)
- Max 10 attempts per user per 24 hours

## Leaderboard
- Uses the **best score** (highest WPM, tiebreaker: highest accuracy) per user per month
- `monthKey` format: `YYYY-MM` (e.g., "2026-02")
- Sector scope uses the user's primary sector at the time of the score
- Top 20 users displayed

## Profile Badge
- Shows on the user's profile page
- Displays best WPM and accuracy for the current month
- Shows level badge:
  - Iniciante: < 50 WPM
  - Intermediario: 50-79 WPM
  - Avancado: >= 80 WPM

## Validation Steps

### Smoke Test
1. **Admin**: Go to `/admin/typing`, create a typing text (any content, difficulty 1)
2. **User**: Go to `/typing`, click "Iniciar Teste"
3. Type the displayed text, click "Finalizar"
4. Verify WPM and accuracy are shown
5. Go to `/typing/leaderboard`, verify your score appears
6. Go to `/profile`, verify the typing badge card shows your score

### Edge Cases
- Submit with < 20s duration: should be rejected
- Submit with > 160 WPM: should be rejected
- Submit expired session: should be rejected
- Submit already submitted session: should be rejected
- 11th attempt in 24h: should be rejected

## Troubleshooting
- If "Iniciar Teste" fails: ensure there is at least one active typing text in the database
- If leaderboard is empty: ensure scores exist for the selected monthKey
- If profile badge shows "no score": user hasn't taken a test this month
- Month key uses America/Sao_Paulo timezone for consistency
