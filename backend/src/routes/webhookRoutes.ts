import { Router } from 'express';
import { handleEvolutionWebhook } from '../controllers/webhookController';

const router = Router();

router.post('/evolution', handleEvolutionWebhook);

export default router;
