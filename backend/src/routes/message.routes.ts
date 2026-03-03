import { Router } from 'express';
import { bulkSend } from '../controllers/sendController';
import { authMiddleware } from '../middlewares/authMiddleware'; 

const messageRouter = Router();

messageRouter.post('/bulk', authMiddleware, bulkSend);

export default messageRouter;