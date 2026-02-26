import { Router } from 'express';
import { register, login, approveUser, getUsers } from '../controllers/authController';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.get('/users', getUsers); 
router.patch('/users/:id/approve', approveUser);
export default router;