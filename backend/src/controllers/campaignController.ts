import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import Papa from 'papaparse';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { execFileSync } from 'child_process';

const ffmpegPath = require('ffmpeg-static') as string;
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function convertAudioToMp3(inputPath: string): string {
  const outputPath = inputPath.replace(/\.[^.]+$/, '.mp3');
  execFileSync(ffmpegPath, ['-i', inputPath, '-y', '-codec:a', 'libmp3lame', '-q:a', '2', outputPath]);
  fs.unlinkSync(inputPath);
  return outputPath;
}

const PHONE_COLUMN_NAMES = ['phone', 'telefone', 'numero', 'celular', 'whatsapp', 'fone', 'tel', 'contato', 'id'];

export const createCampaign = async (req: any, res: Response) => {
  try {
    const { name, instanceId, message, mediaType = 'text', delayMin = 20, delayMax = 40 } = req.body;
    let { mediaUrl } = req.body;

    if (!name || !instanceId || !message) {
      return res.status(400).json({ error: 'Campos obrigatorios: name, instanceId, message' });
    }

    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance || instance.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Instancia nao encontrada' });
    }

    const files = req.files as Record<string, Express.Multer.File[]> | undefined;
    if (files?.media?.[0] && !mediaUrl) {
      const mediaFile = files.media[0];
      const ext = path.extname(mediaFile.originalname) || '.bin';
      const id = crypto.randomUUID();
      let filename = `${id}${ext}`;
      const filepath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filepath, mediaFile.buffer);

      // webm -> mp3 (WhatsApp nao reproduz webm)
      const isAudio = mediaFile.mimetype.startsWith('audio/');
      if (isAudio && ['.webm', '.weba'].includes(ext.toLowerCase())) {
        try {
          const mp3Path = convertAudioToMp3(filepath);
          filename = path.basename(mp3Path);
        } catch (err) {
          console.error('Erro ao converter audio:', err);
        }
      }

      const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
      mediaUrl = `${baseUrl}/uploads/${filename}`;
    }

    let leadsData: { phone: string; name?: string; variables?: Record<string, string> }[] = [];

    const csvFile = files?.csv?.[0];
    if (csvFile) {
      const csvText = csvFile.buffer.toString('utf-8');
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });

      if (parsed.errors.length > 0) {
        return res.status(400).json({ error: 'Erro ao processar CSV', details: parsed.errors });
      }

      leadsData = (parsed.data as Record<string, string>[]).map(row => {
        const keys = Object.keys(row);

        let phoneKey = keys.find(k => PHONE_COLUMN_NAMES.some(term => k.toLowerCase().includes(term)));
        if (!phoneKey) phoneKey = keys.find(k => (row[k] || '').replace(/\D/g, '').length >= 10);
        if (!phoneKey) phoneKey = keys[0];

        const phone = row[phoneKey] || '';
        const leadName = row.name || row.nome || row.Name || undefined;

        const variables: Record<string, string> = {};
        Object.entries(row).forEach(([key, value]) => { variables[key] = value; });

        return { phone: phone.replace(/\D/g, ''), name: leadName, variables };
      }).filter(lead => lead.phone.length >= 10);
    } else if (req.body.leads) {
      const rawLeads = typeof req.body.leads === 'string' ? JSON.parse(req.body.leads) : req.body.leads;
      leadsData = rawLeads.map((lead: any) => ({
        phone: String(lead.phone || '').replace(/\D/g, ''),
        name: lead.name,
        variables: lead.variables || {}
      })).filter((lead: any) => lead.phone.length >= 10);
    }

    if (leadsData.length === 0) {
      return res.status(400).json({ error: 'Nenhum lead valido encontrado. Envie CSV ou leads no body.' });
    }

    const minDelay = Math.max(10, Math.min(120, Number(delayMin) || 20));
    const maxDelay = Math.max(minDelay, Math.min(120, Number(delayMax) || 40));

    const campaign = await prisma.campaign.create({
      data: {
        name,
        message,
        mediaType,
        mediaUrl: mediaUrl || null,
        delayMin: minDelay,
        delayMax: maxDelay,
        totalLeads: leadsData.length,
        ownerId: req.userId,
        instanceId,
        leads: {
          create: leadsData.map(lead => ({
            phone: lead.phone,
            name: lead.name,
            variables: lead.variables || {}
          }))
        }
      },
      include: { leads: { select: { id: true, phone: true, name: true, status: true } } }
    });

    return res.status(201).json(campaign);
  } catch (error) {
    console.error('Erro ao criar campanha:', error);
    return res.status(500).json({ error: 'Erro ao criar campanha' });
  }
};

export const getCampaigns = async (req: any, res: Response) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { ownerId: req.userId },
      orderBy: { createdAt: 'desc' },
      include: {
        instance: { select: { id: true, displayName: true, name: true, status: true } }
      }
    });
    return res.json(campaigns);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar campanhas' });
  }
};

export const getCampaign = async (req: any, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({
      where: { id: req.params.id },
      include: {
        instance: { select: { id: true, displayName: true, name: true, status: true } }
      }
    });

    if (!campaign || campaign.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Campanha nao encontrada' });
    }

    return res.json(campaign);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar campanha' });
  }
};

export const startCampaign = async (req: any, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });

    if (!campaign || campaign.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Campanha nao encontrada' });
    }

    if (!['IDLE', 'PAUSED'].includes(campaign.status)) {
      return res.status(400).json({ error: `Nao e possivel iniciar campanha com status ${campaign.status}` });
    }

    const instance = await prisma.instance.findUnique({ where: { id: campaign.instanceId } });
    if (!instance || instance.status !== 'CONNECTED') {
      return res.status(400).json({ error: 'Instancia nao esta conectada' });
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status: 'SENDING',
        startedAt: campaign.startedAt || new Date()
      }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao iniciar campanha' });
  }
};

export const pauseCampaign = async (req: any, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });

    if (!campaign || campaign.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Campanha nao encontrada' });
    }

    if (campaign.status !== 'SENDING') {
      return res.status(400).json({ error: 'Campanha nao esta em andamento' });
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'PAUSED' }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao pausar campanha' });
  }
};

export const cancelCampaign = async (req: any, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });

    if (!campaign || campaign.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Campanha nao encontrada' });
    }

    if (['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
      return res.status(400).json({ error: 'Campanha ja finalizada' });
    }

    const updated = await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'CANCELLED', completedAt: new Date() }
    });

    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao cancelar campanha' });
  }
};

export const getCampaignLeads = async (req: any, res: Response) => {
  try {
    const campaign = await prisma.campaign.findUnique({ where: { id: req.params.id } });

    if (!campaign || campaign.ownerId !== req.userId) {
      return res.status(404).json({ error: 'Campanha nao encontrada' });
    }

    const { status, page = '1', limit = '50' } = req.query;
    const pageNum = Math.max(1, parseInt(page as string));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string)));

    const where: any = { campaignId: campaign.id };
    if (status) where.status = status;

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        orderBy: { sentAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum
      }),
      prisma.lead.count({ where })
    ]);

    return res.json({
      leads,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) }
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao buscar leads' });
  }
};
