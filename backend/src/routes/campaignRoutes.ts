import { Router } from 'express';
import multer from 'multer';
import { authMiddleware, permissionMiddleware, dailyLimitMiddleware, mediaPermissionMiddleware } from '../middlewares/authMiddleware';
import {
  createCampaign, getCampaigns, getCampaign,
  startCampaign, pauseCampaign, cancelCampaign,
  updateCampaign, deleteCampaign, addLeads, retryCampaign, resendCampaign, getCampaignLeads
} from '../controllers/campaignController';
import { campaignProgress } from '../controllers/sseController';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }
});

router.get('/:id/progress', campaignProgress);

router.use(authMiddleware);

router.get('/', getCampaigns);
router.post('/', permissionMiddleware('campaigns'), upload.fields([
  { name: 'csv', maxCount: 1 },
  { name: 'media', maxCount: 1 }
]), mediaPermissionMiddleware, createCampaign);
router.get('/:id', getCampaign);
router.put('/:id', permissionMiddleware('campaigns'), upload.fields([{ name: 'media', maxCount: 1 }]), updateCampaign);
router.delete('/:id', deleteCampaign);
router.post('/:id/start', permissionMiddleware('campaigns'), dailyLimitMiddleware, startCampaign);
router.post('/:id/pause', pauseCampaign);
router.post('/:id/cancel', cancelCampaign);
router.post('/:id/leads', permissionMiddleware('campaigns'), upload.fields([{ name: 'csv', maxCount: 1 }]), addLeads);
router.post('/:id/retry', permissionMiddleware('campaigns'), dailyLimitMiddleware, retryCampaign);
router.post('/:id/resend', permissionMiddleware('campaigns'), dailyLimitMiddleware, resendCampaign);
router.get('/:id/leads', getCampaignLeads);

export default router;
