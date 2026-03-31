# EdTech Platform - Deployment Guide

This guide covers the complete deployment process for the EdTech Platform using Railway.

## Prerequisites

- Railway account ([railway.app](https://railway.app))
- Supabase project with database configured
- GitHub repository with the codebase
- Redis instance (Railway provides managed Redis)

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│    Backend      │────▶│   Supabase      │
│   (Next.js)     │     │    (Express)    │     │   PostgreSQL    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │     Redis       │
                        │    (Cache)      │
                        └─────────────────┘
```

## Step 1: Prepare Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the database migrations from `supabase/migrations/`
3. Enable Row Level Security (RLS)
4. Get your credentials:
   - Project URL
   - Anon Key
   - Service Role Key
   - Database Connection String

## Step 2: Deploy to Railway

### Option A: Using Railway Dashboard

1. **Create New Project**
   - Go to Railway Dashboard
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your repository

2. **Add Services**
   - Add `backend` service from `/backend` directory
   - Add `frontend` service from `/frontend` directory
   - Add `Redis` service from Railway's template

3. **Configure Backend Environment Variables**
   ```
   NODE_ENV=production
   PORT=3001
   DATABASE_URL=<your-supabase-db-url>
   SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_KEY=<your-service-key>
   REDIS_URL=${{Redis.REDIS_URL}}
   JWT_SECRET=<generate-a-secure-secret>
   ```

4. **Configure Frontend Environment Variables**
   ```
   NODE_ENV=production
   NEXT_PUBLIC_API_URL=https://<backend-url>
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
   ```

5. **Generate Domains**
   - Go to each service settings
   - Generate a domain for both frontend and backend

### Option B: Using Railway CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Deploy Services**
   ```bash
   # Deploy backend
   cd backend
   railway up
   
   # Deploy frontend
   cd ../frontend
   railway up
   ```

5. **Add Redis**
   ```bash
   railway add --plugin redis
   ```

## Step 3: Configure Variables

Use the Railway dashboard or CLI to set environment variables:

```bash
# Set backend variables
railway variables set NODE_ENV=production --service backend
railway variables set JWT_SECRET=your-secure-secret --service backend

# Set frontend variables
railway variables set NEXT_PUBLIC_API_URL=https://your-backend.railway.app --service frontend
```

## Step 4: Database Setup

1. **Run Migrations**
   ```bash
   # Connect to backend container
   railway run npm run db:migrate --service backend
   ```

2. **Create Super Admin**
   ```bash
   railway run npm run seed:admin --service backend
   ```

## Step 5: Verify Deployment

1. Check backend health: `https://your-backend.railway.app/health`
2. Access frontend: `https://your-frontend.railway.app`
3. Test login with admin credentials

## Monitoring & Logs

### View Logs
```bash
railway logs --service backend
railway logs --service frontend
```

### Health Checks
- Backend: `/health` endpoint
- Frontend: `/api/health` endpoint

## Scaling

Railway supports horizontal scaling:

1. Go to Service Settings
2. Adjust "Num Replicas" (available on Pro plan)
3. Configure load balancing

## Troubleshooting

### Common Issues

1. **Build Failures**
   - Check build logs in Railway dashboard
   - Verify all dependencies in package.json
   - Ensure Dockerfile is correct

2. **Database Connection**
   - Verify DATABASE_URL format
   - Check Supabase IP allowlist
   - Ensure SSL is configured

3. **Redis Connection**
   - Verify REDIS_URL is correctly linked
   - Check Redis instance status

4. **Environment Variables**
   - Ensure all required variables are set
   - Check for typos in variable names
   - Verify secrets are not exposed

### Debug Mode

Enable debug logging:
```bash
railway variables set LOG_LEVEL=debug --service backend
```

## Rollback

To rollback a deployment:

1. Go to Railway Dashboard
2. Select the service
3. Go to "Deployments" tab
4. Click "Rollback" on previous deployment

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Railway

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Railway CLI
        run: npm install -g @railway/cli
        
      - name: Deploy Backend
        run: railway up --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
          
      - name: Deploy Frontend
        run: railway up --service frontend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```

## Security Checklist

- [ ] All secrets stored in Railway variables (not in code)
- [ ] JWT_SECRET is a strong, unique secret
- [ ] Supabase RLS policies are configured
- [ ] CORS is properly configured
- [ ] Rate limiting is enabled
- [ ] HTTPS is enforced (automatic on Railway)

## Estimated Costs

### Railway Pricing (as of 2024)

| Resource | Free Tier | Pro Plan |
|----------|-----------|----------|
| Execution | 500 hours/month | Unlimited |
| Memory | 1GB | 8GB+ |
| Database | Shared | Dedicated |

For production, expect ~$5-20/month depending on traffic.

## Support

- Railway Documentation: [docs.railway.app](https://docs.railway.app)
- Supabase Documentation: [supabase.com/docs](https://supabase.com/docs)
- Project Issues: [GitHub Issues](your-repo-url)