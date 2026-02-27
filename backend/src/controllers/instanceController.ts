import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import axios from 'axios';

export const createInstance = async (req: any, res: Response) => {
  try {
    const { name } = req.body;
    const userId = req.userId;

    if (!name) return res.status(400).json({ error: 'Nome é obrigatório' });

    await axios.post(`${process.env.EVOLUTION_API_URL}/instance/create`, {
      instanceName: name,
      qrcode: true
    }, {
      headers: { 'apikey': process.env.EVOLUTION_API_KEY }
    });

    const instance = await prisma.instance.create({
      data: { name, ownerId: userId, status: 'DISCONNECTED' }
    });

    return res.status(201).json(instance);
  } catch (error: any) {
    if (error.response?.data?.message?.includes("already exists")) {
       const existing = await prisma.instance.create({
         data: { name: req.body.name, ownerId: req.userId, status: 'DISCONNECTED' }
       });
       return res.status(201).json(existing);
    }
    return res.status(500).json({ error: 'Erro ao criar instância' });
  }
};

export const getMyInstances = async (req: any, res: Response) => {
  try {
    const instances = await prisma.instance.findMany({ where: { ownerId: req.userId } });
    
    const syncedInstances = await Promise.all(instances.map(async (inst) => {
      try {
        const resp = await axios.get(`${process.env.EVOLUTION_API_URL}/instance/connectionState/${inst.name}`, {
          headers: { 'apikey': process.env.EVOLUTION_API_KEY }
        });
        const status = resp.data.instance.state === 'open' ? 'CONNECTED' : 'DISCONNECTED';
        if (status !== inst.status) {
          return await prisma.instance.update({ where: { id: inst.id }, data: { status } });
        }
        return inst;
      } catch {
        return inst;
      }
    }));

    return res.json(syncedInstances);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar instâncias' });
  }
};

export const getQRCode = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance) return res.status(404).json({ error: 'Não encontrada' });

    const response = await axios.get(
      `${process.env.EVOLUTION_API_URL}/instance/connect/${instance.name}`,
      { headers: { 'apikey': process.env.EVOLUTION_API_KEY } }
    );
    return res.json({ qrcode: response.data.base64 });
  } catch (error: any) {
    return res.status(500).json({ error: 'Erro ao gerar QR Code' });
  }
};

export const syncInstanceStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    const response = await axios.get(
      `${process.env.EVOLUTION_API_URL}/instance/connectionState/${instance.name}`,
      { headers: { 'apikey': process.env.EVOLUTION_API_KEY } }
    );

    const statusMap: any = { "open": "CONNECTED", "close": "DISCONNECTED", "connecting": "CONNECTING" };
    const realStatus = statusMap[response.data.instance.state] || 'DISCONNECTED';

    const updated = await prisma.instance.update({
      where: { id },
      data: { status: realStatus }
    });

    return res.json(updated);
  } catch (error: any) {
    console.error("Erro no Sync:", error.message);
    return res.status(500).json({ error: 'Erro ao sincronizar' });
  }
};

export const deleteInstance = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const instance = await prisma.instance.findUnique({ where: { id } });

    if (!instance) return res.status(404).json({ error: 'Instância não encontrada' });

    try {
      await axios.delete(`${process.env.EVOLUTION_API_URL}/instance/logout/${instance.name}`, {
        headers: { 'apikey': process.env.EVOLUTION_API_KEY }
      });
    } catch (e) {
      console.log("Instância já estava offline no motor, prosseguindo...");
    }

    try {
      await axios.delete(`${process.env.EVOLUTION_API_URL}/instance/delete/${instance.name}`, {
        headers: { 'apikey': process.env.EVOLUTION_API_KEY }
      });
    } catch (e) {
      console.log("Erro ao remover do motor, removendo apenas do banco de dados.");
    }

    await prisma.instance.delete({ where: { id } });

    return res.json({ message: 'Instância removida com sucesso' });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao processar exclusão' });
  }
};