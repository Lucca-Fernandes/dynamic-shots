import { Router } from 'express';
import { register, login, approveUser, getUsers } from '../controllers/authController';
import { authMiddleware, roleMiddleware } from '../middlewares/authMiddleware';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', authMiddleware, roleMiddleware('ADMIN'), getUsers);
router.patch('/users/:id/approve', authMiddleware, roleMiddleware('ADMIN'), approveUser);

export default router;
