import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from 'dotenv';
import cookieParser from 'cookie-parser';
import { rateLimiter, authRateLimiter, twoFactorRateLimiter } from './middleware/rateLimiter';
import auditLogger from './middleware/auditLogger';

// Import routes
import authRoutes from './routes/auth.routes';
import superAdminRoutes from './routes/superAdmin.routes';
import adminRoutes from './routes/admin.routes';
import branchAdminRoutes from './routes/branchAdmin.routes';
import studentRoutes from './routes/student.routes';

config();

const app = express();
const PORT = process.env.PORT || 4000;

// Trust proxy for Railway deployment
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id'],
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Rate limiting
app.use('/api/auth/login', authRateLimiter);
app.use('/api/auth/2fa', twoFactorRateLimiter);
app.use('/api', rateLimiter);

// Audit logging for mutating requests
app.use('/api', auditLogger);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/branch-admin', branchAdminRoutes);
app.use('/api/student', studentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not Found' });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err.message);
  
  // Handle CORS errors
  if (err.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'CORS policy violation' });
    return;
  }

  if (process.env.NODE_ENV === 'production') {
    res.status(500).json({ error: 'Internal Server Error' });
  } else {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
});

export default app;