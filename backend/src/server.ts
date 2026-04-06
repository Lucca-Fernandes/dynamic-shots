import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import instanceRoutes from './routes/instanceRoutes';
import messageRoutes from './routes/message.routes';
import campaignRoutes from './routes/campaignRoutes';
import webhookRoutes from './routes/webhookRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { startCampaignWorker, recoverFromCrash } from './workers/campaignWorker';

dotenv.config();

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('CORS not allowed'));
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/instances', instanceRoutes);
app.use('/messages', messageRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/upload', uploadRoutes);

app.get('/health', (_req, res) => {
  res.json({ status: 'OK' });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await recoverFromCrash();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
  startCampaignWorker();
}

bootstrap();
