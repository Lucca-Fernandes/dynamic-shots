import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middlewares/authMiddleware';
import {
  createCampaign, getCampaigns, getCampaign,
  startCampaign, pauseCampaign, cancelCampaign, getCampaignLeads
} from '../controllers/campaignController';
import { campaignProgress } from '../controllers/sseController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

// SSE: auth via query param (EventSource nao suporta headers)
router.get('/:id/progress', campaignProgress);

router.use(authMiddleware);

router.get('/', getCampaigns);
router.post('/', upload.fields([
  { name: 'csv', maxCount: 1 },
  { name: 'media', maxCount: 1 }
]), createCampaign);
router.get('/:id', getCampaign);
router.post('/:id/start', startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/cancel', cancelCampaign);
router.get('/:id/leads', getCampaignLeads);

export default router;
