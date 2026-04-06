import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import axios from 'axios';
import crypto from 'crypto';

export const createInstance = async (req: any, res: Response) => {
  const { name: displayName } = req.body;
  const userId = req.userId;

  if (!displayName) return res.status(400).json({ error: 'Nome da instancia e obrigatorio' });

  const existingName = await prisma.instance.findFirst({
    where: { ownerId: userId, displayName: displayName.trim() }
  });
  if (existingName) {
    return res.status(400).json({ error: 'Voce ja possui uma instancia com esse nome.' });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { permissions: true, role: true, isSuspended: true }
  });
  if (user?.isSuspended) {
    return res.status(403).json({ error: 'Sua conta esta suspensa.' });
  }
  if (user && user.role !== 'ADMIN') {
    const perms = (user.permissions as Record<string, boolean>) || {};
    if (!perms.multiInstance) {
      const count = await prisma.instance.count({ where: { ownerId: userId } });
      if (count >= 1) {
        return res.status(403).json({ error: 'Voce so pode ter uma instancia. Contate o administrador para liberar multiplas instancias.' });
      }
    }
  }

  const systemName = `${userId}-${crypto.randomUUID()}`;
  const webhookUrl = `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/webhooks/evolution`;

  try {
    await axios.post(`${process.env.EVOLUTION_API_URL}/instance/create`, {
      instanceName: systemName,
      qrcode: true
    }, {
      headers: { 'apikey': process.env.EVOLUTION_API_KEY }
    });

    await axios.post(`${process.env.EVOLUTION_API_URL}/webhook/set/${systemName}`, {
      enabled: true,
      url: webhookUrl,
      events: ['CONNECTION_UPDATE', 'MESSAGES_UPSERT', 'QRCODE_UPDATED']
    }, {
      headers: { 'apikey': process.env.EVOLUTION_API_KEY }
    }).catch(err => {
      console.error('Aviso: falha ao registrar webhook:', err.message);
    });

    const instance = await prisma.instance.create({
      data: { name: systemName, displayName, ownerId: userId, status: 'DISCONNECTED' }
    });

    return res.status(201).json(instance);
  } catch (error: any) {
    if (error.response?.data?.message?.includes("already exists")) {
      const instance = await prisma.instance.create({
        data: { name: systemName, displayName: req.body.name, ownerId: req.userId, status: 'DISCONNECTED' }
      });
      return res.status(201).json(instance);
    }
    return res.status(500).json({ error: 'Erro ao criar instancia' });
  }
};

export const getMyInstances = async (req: any, res: Response) => {
  try {
    const instances = await prisma.instance.findMany({
      where: { ownerId: req.userId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(instances);
  } catch {
    return res.status(500).json({ error: 'Erro ao buscar instancias' });
  }
};

export const getQRCode = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance || instance.ownerId !== req.userId) return res.status(404).json({ error: 'Nao encontrada' });

    const response = await axios.get(
      `${process.env.EVOLUTION_API_URL}/instance/connect/${instance.name}`,
      { headers: { 'apikey': process.env.EVOLUTION_API_KEY } }
    );
    return res.json({ qrcode: response.data.base64 });
  } catch {
    return res.status(500).json({ error: 'Erro ao gerar QR Code' });
  }
};

export const syncInstanceStatus = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const instance = await prisma.instance.findUnique({ where: { id } });
    if (!instance || instance.ownerId !== req.userId) return res.status(404).json({ error: 'Instancia nao encontrada' });

    const response = await axios.get(
      `${process.env.EVOLUTION_API_URL}/instance/connectionState/${instance.name}`,
      { headers: { 'apikey': process.env.EVOLUTION_API_KEY } }
    );

    const statusMap: Record<string, string> = { open: 'CONNECTED', close: 'DISCONNECTED', connecting: 'CONNECTING' };
    const realStatus = statusMap[response.data.instance.state] || 'DISCONNECTED';

    const updated = await prisma.instance.update({ where: { id }, data: { status: realStatus } });
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

    if (!instance) return res.json({ message: "Ja removido" });
    if (instance.ownerId !== req.userId) return res.status(403).json({ error: 'Nao autorizado' });

    await axios.delete(`${process.env.EVOLUTION_API_URL}/instance/logout/${instance.name}`, {
      headers: { 'apikey': process.env.EVOLUTION_API_KEY }
    }).catch(() => null);

    await axios.delete(`${process.env.EVOLUTION_API_URL}/instance/delete/${instance.name}`, {
      headers: { 'apikey': process.env.EVOLUTION_API_KEY }
    }).catch(() => null);

    await prisma.instance.delete({ where: { id } });
    return res.json({ message: "Deletado com sucesso" });
  } catch {
    return res.status(500).json({ error: 'Erro ao processar exclusao' });
  }
};
