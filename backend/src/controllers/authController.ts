import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';

export const getMyLimits = async (req: any, res: Response) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.userId },
            select: {
                maxDailyShots: true, dailyShotsSent: true, dailyShotsDate: true,
                totalShotsSent: true, permissions: true, isSuspended: true
            }
        });
        if (!user) return res.status(404).json({ error: 'Usuario nao encontrado' });

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const userDate = user.dailyShotsDate ? new Date(user.dailyShotsDate) : null;
        const isToday = userDate && new Date(userDate).setHours(0, 0, 0, 0) === today.getTime();

        res.json({
            maxDailyShots: user.maxDailyShots,
            dailyShotsSent: isToday ? user.dailyShotsSent : 0,
            totalShotsSent: user.totalShotsSent,
            dailyLimitReached: isToday ? user.dailyShotsSent >= user.maxDailyShots : false,
            permissions: user.permissions,
            isSuspended: user.isSuspended
        });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar limites' });
    }
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const { name, email, password } = req.body;

        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            res.status(400).json({ error: 'E-mail já cadastrado' });
            return;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                password: hashedPassword,
                role: 'USER'
            }
        });

        res.status(201).json({
            message: 'Usuário criado com sucesso! Aguarde a aprovação do administrador.',
            userId: user.id
        });
    } catch (error) {
        console.error("ERRO NO REGISTRO:", error);
        res.status(500).json({ error: 'Erro ao registrar usuário' });
    }
};

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                name: true,
                email: true,
                password: true,
                isApproved: true,
                isSuspended: true,
                role: true
            }
        });

        if (!user) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Credenciais inválidas' });
            return;
        }

        if (!user.isApproved) {
            res.status(403).json({
                error: 'Sua conta ainda não foi aprovada pelo administrador.'
            });
            return;
        }

        if (user.isSuspended) {
            res.status(403).json({
                error: 'Sua conta foi suspensa. Entre em contato com o administrador.'
            });
            return;
        }

        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET!,
            { expiresIn: '1d' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("ERRO NO LOGIN:", error);
        res.status(500).json({ error: 'Erro interno no servidor' });
    }
};

export const getUsers = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                name: true,
                email: true,
                isApproved: true,
                role: true,
                createdAt: true,
                updatedAt: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuários' });
    }
};

export const approveUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.user.update({
            where: { id: id as string },
            data: { isApproved: true }
        });
        res.json({ message: 'Usuário aprovado com sucesso!' });
    } catch (error) {
        res.status(500).json({ error: 'Erro ao aprovar usuário' });
    }
};

export const updateUser = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { role, isApproved, isSuspended, maxDailyShots, permissions } = req.body;

        const data: any = {};
        if (role !== undefined) data.role = role;
        if (isApproved !== undefined) data.isApproved = isApproved;
        if (isSuspended !== undefined) data.isSuspended = isSuspended;
        if (maxDailyShots !== undefined) data.maxDailyShots = Math.max(0, Number(maxDailyShots));
        if (permissions !== undefined) data.permissions = permissions;

        const user = await prisma.user.update({
            where: { id },
            data,
            select: {
                id: true, name: true, email: true, role: true,
                isApproved: true, isSuspended: true,
                maxDailyShots: true, dailyShotsSent: true, dailyShotsDate: true,
                totalShotsSent: true, permissions: true,
                createdAt: true, updatedAt: true
            }
        });

        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao atualizar usuario' });
    }
};

export const getUserStats = async (req: Request, res: Response) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true, name: true, email: true, role: true,
                isApproved: true, isSuspended: true,
                maxDailyShots: true, dailyShotsSent: true, dailyShotsDate: true,
                totalShotsSent: true, permissions: true,
                createdAt: true, updatedAt: true,
                _count: { select: { instances: true, campaigns: true } }
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao buscar usuarios' });
    }
};

export const resetDailyShots = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.update({
            where: { id },
            data: { dailyShotsSent: 0, dailyShotsDate: new Date() },
            select: { id: true, dailyShotsSent: true }
        });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao resetar disparos' });
    }
};