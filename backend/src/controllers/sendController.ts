import { Request, Response } from 'express';
import { prisma } from '../lib/prisma';
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

export async function bulkSend(req: Request, res: Response) {
  const { instanceId, message, numbers, delayMin = 20, delayMax = 40, mediaType = 'text' } = req.body;
  let { mediaUrl } = req.body;
  const leads = typeof req.body.leads === 'string' ? JSON.parse(req.body.leads) : req.body.leads;

  const files = (req as any).files as Record<string, Express.Multer.File[]> | undefined;
  if (files?.media?.[0] && !mediaUrl) {
    const mediaFile = files.media[0];
    const ext = path.extname(mediaFile.originalname).toLowerCase() || '.bin';
    const id = crypto.randomUUID();
    let filename = `${id}${ext}`;
    const filepath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filepath, mediaFile.buffer);

    const isAudio = mediaFile.mimetype.startsWith('audio/');
    if (isAudio && ['.webm', '.weba'].includes(ext)) {
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

  let normalizedLeads: { phone: string; name?: string; variables?: Record<string, string> }[];
  if (Array.isArray(leads) && leads.length > 0) {
    normalizedLeads = leads.map((lead: any) => {
      const { phone, name, nome, variables, ...rest } = lead;
      return {
        phone: String(phone || '').replace(/\D/g, ''),
        name: name || nome,
        variables: { ...rest, ...(variables || {}), ...(nome ? { nome } : {}), ...(name ? { name } : {}) }
      };
    });
  } else if (Array.isArray(numbers) && numbers.length > 0) {
    normalizedLeads = numbers.map((n: string) => ({ phone: n.replace(/\D/g, '') }));
  } else {
    return res.status(400).json({ error: 'Envie "leads" ou "numbers" no body' });
  }

  normalizedLeads = normalizedLeads.filter(l => l.phone.length >= 10);
  if (normalizedLeads.length === 0) {
    return res.status(400).json({ error: 'Nenhum lead valido encontrado' });
  }

  try {
    const instance = await prisma.instance.findUnique({ where: { id: instanceId } });
    if (!instance) return res.status(404).json({ error: 'Instancia nao encontrada' });
    if ((req as any).userId !== instance.ownerId) {
      return res.status(403).json({ error: 'Nao autorizado' });
    }

    const minDelay = Math.max(10, Math.min(120, Number(delayMin) || 20));
    const maxDelay = Math.max(minDelay, Math.min(120, Number(delayMax) || 40));

    const campaign = await prisma.campaign.create({
      data: {
        name: `Disparo rapido - ${new Date().toLocaleString('pt-BR')}`,
        message,
        mediaType,
        mediaUrl: mediaUrl || null,
        delayMin: minDelay,
        delayMax: maxDelay,
        totalLeads: normalizedLeads.length,
        status: 'SENDING',
        startedAt: new Date(),
        ownerId: (req as any).userId,
        instanceId,
        leads: {
          create: normalizedLeads.map(lead => ({
            phone: lead.phone,
            name: lead.name,
            variables: lead.variables || {}
          }))
        }
      }
    });

    return res.status(202).json({ message: 'Disparo iniciado com sucesso', campaignId: campaign.id });
  } catch (error) {
    console.error('Erro no controlador de disparo:', error);
    return res.status(500).json({ error: 'Erro interno no disparo' });
  }
}
