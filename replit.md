# 41 Hub - Portal Corporativo

## Overview

41 Hub is an internal corporate portal for "41 Tech" company. It serves as a centralized hub for accessing internal applications (APPs) and dashboards (Power BI). The system features Microsoft Entra ID (Azure AD) authentication, role-based access control (RBAC) with sector-based permissions, and a gateway/proxy architecture to protect internal resources.

Key features:
- Microsoft Entra ID OAuth2/OIDC authentication
- Role-based access control: Admin, Coordenador (Coordinator), Usuario (User)
- Multi-sector user assignment (users can belong to multiple sectors with the same role)
- Sector-based resource visibility with allow/deny overrides per user
- Resource open behavior control (HUB_ONLY, NEW_TAB_ONLY, BOTH)
- Internal apps served via iframe or gateway proxy
- Power BI dashboard embedding support
- Global search, favorites, recent access tracking
- Employee directory with sector filtering and search
- Profile page with WhatsApp and photo updates
- Resource health monitoring
- Admin dashboard with activity logs and summary metrics
- Audit logging for security compliance
- Light/dark theme support

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom build script
- **Routing**: Wouter (lightweight router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui (Radix UI primitives) with Tailwind CSS
- **Styling**: Tailwind CSS with CSS variables for theming (light/dark modes)
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript with ESM modules
- **Session Management**: express-session with PostgreSQL store (connect-pg-simple)
- **API Design**: RESTful endpoints under `/api/` prefix
- **Authentication**: Microsoft Entra ID OAuth2/OIDC flow with JWT validation
- **Authorization**: RBAC middleware with sector-based permissions and user-level overrides

### Database Layer
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between frontend and backend)
- **Migrations**: Drizzle Kit with `db:push` command
- **Key Tables**: users, sectors, roles, user_sector_roles, resources, resource_overrides, favorites, recent_access, audit_logs, health_checks

### Authentication Flow
1. User clicks "Login with Microsoft" 
2. Redirect to Microsoft Entra ID authorization endpoint
3. Callback receives authorization code, exchanges for tokens
4. Backend validates JWT and extracts user claims (oid, email, name, groups)
5. User record created/updated in database
6. Session established with userId

### Authorization Model
- **Admin**: Full access to all sectors and resources, complete admin panel
- **Coordenador**: Full access to their sector, can manage users within their sector
- **Usuario**: Access defined by sector membership plus allow/deny overrides per resource
- Resources are filtered server-side based on user's sector memberships and overrides

### Security Measures
- All admin API routes protected with `requireAdmin` middleware
- Zod validation on all admin create/update endpoints
- Development auto-login disabled in production mode (returns 501)
- Session secret required for production (SESSION_SECRET env var) - app fails to start without it
- SameSite=strict cookie policy for CSRF protection
- HttpOnly cookies to prevent XSS access to session
- Comprehensive audit logging for all admin operations

### Resource Gateway Pattern
- Internal apps are NOT directly exposed to the internet
- Access flows through Hub's gateway/proxy endpoints
- Gateway validates user token and authorization before proxying requests
- CSP headers and X-Frame-Options configured for iframe embedding
- Power BI dashboards use embed tokens generated server-side

## External Dependencies

### Authentication
- **Microsoft Entra ID**: OAuth2/OIDC identity provider
- Environment variables: `ENTRA_CLIENT_ID`, `ENTRA_CLIENT_SECRET`, `ENTRA_TENANT_ID`, `ENTRA_ADMIN_EMAIL`

### Database
- **PostgreSQL**: Primary data store
- Environment variable: `DATABASE_URL`
- Session store: connect-pg-simple for persistent sessions

### Power BI Integration (Placeholder)
- Designed for Power BI embedded analytics
- Resource metadata stores: workspaceId, reportId, pageName, filters
- Backend endpoints prepared for embed token generation

### UI Framework
- **shadcn/ui**: Component library based on Radix UI
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Build & Development
- **Vite**: Frontend dev server and bundler
- **esbuild**: Backend bundling for production
- **tsx**: TypeScript execution for development
- **Drizzle Kit**: Database schema management