# EdTech Platform

A white-label, multi-institute EdTech platform with three isolated dashboards, branch-scoped data, and separate Railway deployments for frontend and backend.

## Architecture

- **Frontend**: Next.js 14 (App Router, TypeScript) with Tailwind CSS
- **Backend**: Node.js + Express (TypeScript) with Supabase
- **Cache/Queue**: Redis + BullMQ
- **Auth**: JWT + bcrypt + TOTP (2FA)
- **Deployment**: Railway (3 services)

## Three-Dashboard Architecture

| Dashboard | Route Prefix | Role | Scope |
|-----------|--------------|------|-------|
| Super Admin | `/super-admin/*` | super_admin | Global (all branches) |
| Branch Admin | `/admin/*` | branch_admin | One branch only |
| Student | `/dashboard` | student | Own data only |

## Getting Started

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account
- Redis instance (for production)

### Installation

1. Clone the repository
2. Copy `.env.template` to `.env` and fill in your values
3. Install dependencies:

```bash
npm install
```

4. Run development servers:

```bash
npm run dev
```

## Project Structure

```
edtech-platform/
├── frontend/          # Next.js 14 App Router
│   ├── src/
│   │   ├── app/       # Route groups for each dashboard
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── styles/
│   └── public/
├── backend/           # Node.js + Express API
│   └── src/
│       ├── routes/
│       ├── controllers/
│       ├── middleware/
│       ├── workers/
│       └── utils/
└── package.json       # Root workspace
```

## Deployment

See [DEPLOY.md](./DEPLOY.md) for Railway deployment instructions.

## License

ISC