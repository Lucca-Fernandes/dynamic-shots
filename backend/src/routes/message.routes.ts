import { Router } from 'express';
import { bulkSend } from '../controllers/sendController';

const messageRouter = Router();

messageRouter.post('/bulk', bulkSend);

export default messageRouter;