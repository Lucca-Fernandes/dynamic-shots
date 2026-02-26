import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/authRoutes';
import instanceRoutes from './routes/instanceRoutes'; 
import messageRoutes from './routes/message.routes';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Rotas
app.use('/auth', authRoutes);
app.use('/instances', instanceRoutes); 
app.use('/messages', messageRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Dynamic Shots rodando!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});