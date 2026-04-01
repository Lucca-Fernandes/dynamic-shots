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
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

app.use('/auth', authRoutes);
app.use('/instances', instanceRoutes);
app.use('/messages', messageRoutes);
app.use('/campaigns', campaignRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/upload', uploadRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Dynamic Shots rodando!' });
});

const PORT = process.env.PORT || 5000;

async function bootstrap() {
  await recoverFromCrash();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
  startCampaignWorker();
}

bootstrap();
