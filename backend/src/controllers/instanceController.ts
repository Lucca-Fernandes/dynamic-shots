import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import axios from 'axios';

export const createInstance = async (req: any, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.userId; 

    if (!name) return res.status(400).json({ error: 'Nome da instância é obrigatório' });

    const instance = await prisma.instance.create({
      data: {
        name,
        ownerId: userId,
        status: 'DISCONNECTED'
      }
    });

    return res.status(201).json(instance);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Erro ao criar instância' });
  }
};

export const getMyInstances = async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const instances = await prisma.instance.findMany({
      where: { ownerId: userId }
    });
    return res.json(instances);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar instâncias' });
  }
};

export const getQRCode = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const instance = await prisma.instance.findUnique({ where: { id } });

    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    const response = await axios.get(
      `${process.env.EVOLUTION_API_URL}/instance/connect/${instance.name}`,
      { headers: { 'apikey': process.env.EVOLUTION_API_KEY } }
    );

    return res.json({ qrcode: response.data.base64 });
  } catch (error: any) {
    console.error('Erro ao buscar QR Code:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Erro ao gerar QR Code na API Externa' });
  }
};