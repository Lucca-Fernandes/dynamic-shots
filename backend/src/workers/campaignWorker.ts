import { prisma } from '../lib/prisma';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

const POLL_INTERVAL = 5000;
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');
const activeCampaigns = new Map<string, boolean>();

function resolveMediaToBase64(url: string): string | null {
  try {
    const uploadsMarker = '/uploads/';
    const idx = url.indexOf(uploadsMarker);
    if (idx === -1) return null;

    const filename = url.substring(idx + uploadsMarker.length);
    const filepath = path.join(UPLOADS_DIR, filename);

    if (fs.existsSync(filepath)) {
      return fs.readFileSync(filepath).toString('base64');
    }

    const mp3Path = filepath.replace(/\.[^.]+$/, '.mp3');
    if (fs.existsSync(mp3Path)) {
      return fs.readFileSync(mp3Path).toString('base64');
    }

    return null;
  } catch {
    return null;
  }
}

function randomDelay(min: number, max: number): Promise<void> {
  const ms = (Math.floor(Math.random() * (max - min + 1)) + min) * 1000;
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function sendMessage(instanceName: string, phone: string, message: string, mediaType: string, mediaUrl?: string | null) {
  const baseUrl = process.env.EVOLUTION_API_URL;
  const headers = { 'apikey': process.env.EVOLUTION_API_KEY };
  const number = `${phone.replace(/\D/g, '')}@s.whatsapp.net`;
  const resolvedMedia = mediaUrl ? (resolveMediaToBase64(mediaUrl) || mediaUrl) : null;

  if (mediaType === 'text' || !resolvedMedia) {
    await axios.post(`${baseUrl}/message/sendText/${instanceName}`, {
      number,
      textMessage: { text: message }
    }, { headers });
  } else if (mediaType === 'image') {
    await axios.post(`${baseUrl}/message/sendMedia/${instanceName}`, {
      number,
      mediaMessage: { mediatype: 'image', caption: message, media: resolvedMedia }
    }, { headers });
  } else if (mediaType === 'video') {
    await axios.post(`${baseUrl}/message/sendMedia/${instanceName}`, {
      number,
      mediaMessage: { mediatype: 'video', caption: message, media: resolvedMedia }
    }, { headers });
  } else if (mediaType === 'audio') {
    if (message && message.trim()) {
      await axios.post(`${baseUrl}/message/sendText/${instanceName}`, {
        number,
        textMessage: { text: message }
      }, { headers });
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    await axios.post(`${baseUrl}/message/sendWhatsAppAudio/${instanceName}`, {
      number,
      options: { presence: 'recording', encoding: true },
      audioMessage: { audio: resolvedMedia }
    }, { headers });
  } else if (mediaType === 'document') {
    await axios.post(`${baseUrl}/message/sendMedia/${instanceName}`, {
      number,
      mediaMessage: { mediatype: 'document', caption: message, media: resolvedMedia, fileName: 'document' }
    }, { headers });
  }
}

async function processOneLead(campaign: any, instance: any) {
  const lead = await prisma.lead.findFirst({
    where: { campaignId: campaign.id, status: 'PENDING' },
    orderBy: { id: 'asc' }
  });

  if (!lead) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'COMPLETED', completedAt: new Date() }
    });
    activeCampaigns.delete(campaign.id);
    console.log(`Campanha ${campaign.id} (${campaign.name}) concluida`);
    return false;
  }

  const owner = await prisma.user.findUnique({
    where: { id: campaign.ownerId },
    select: { maxDailyShots: true, dailyShotsSent: true, dailyShotsDate: true, isSuspended: true }
  });
  if (owner?.isSuspended) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } });
    activeCampaigns.delete(campaign.id);
    console.log(`Campanha ${campaign.id} pausada: usuario suspenso`);
    return false;
  }
  const todayCheck = new Date();
  todayCheck.setHours(0, 0, 0, 0);
  const ownerDate = owner?.dailyShotsDate ? new Date(owner.dailyShotsDate) : null;
  const isSameDay = ownerDate && new Date(ownerDate).setHours(0, 0, 0, 0) === todayCheck.getTime();
  const currentDaily = isSameDay ? (owner?.dailyShotsSent || 0) : 0;
  if (owner && currentDaily >= owner.maxDailyShots) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } });
    activeCampaigns.delete(campaign.id);
    console.log(`Campanha ${campaign.id} pausada: limite diario atingido (${owner.maxDailyShots})`);
    return false;
  }

  await prisma.lead.update({ where: { id: lead.id }, data: { status: 'SENDING' } });

  try {
    let finalMessage = campaign.message;
    const vars = (lead.variables as Record<string, string>) || {};
    const allVars: Record<string, string> = { phone: lead.phone, name: lead.name || '', ...vars };
    Object.entries(allVars).forEach(([key, value]) => {
      const trimmedKey = key.trim();
      const escaped = trimmedKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      finalMessage = finalMessage.replace(new RegExp(`\\{${escaped}\\}`, 'g'), value || '');
    });

    await sendMessage(instance.name, lead.phone, finalMessage, campaign.mediaType, campaign.mediaUrl);

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'SENT', sentAt: new Date() }
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { sentCount: { increment: 1 } }
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const user = await prisma.user.findUnique({ where: { id: campaign.ownerId }, select: { dailyShotsDate: true } });
    const userDailyDate = user?.dailyShotsDate ? new Date(user.dailyShotsDate) : null;
    const isToday = userDailyDate && userDailyDate.setHours(0, 0, 0, 0) === today.getTime();
    await prisma.user.update({
      where: { id: campaign.ownerId },
      data: {
        totalShotsSent: { increment: 1 },
        dailyShotsSent: isToday ? { increment: 1 } : 1,
        dailyShotsDate: new Date()
      }
    });
  } catch (err: any) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`Erro ao enviar para ${lead.phone}:`, detail);
    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'FAILED', errorMsg: err.message?.substring(0, 500) }
    });
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { errorCount: { increment: 1 } }
    });
  }

  return true;
}

async function processCampaign(campaign: any) {
  if (activeCampaigns.get(campaign.id)) return;
  activeCampaigns.set(campaign.id, true);

  const instance = await prisma.instance.findUnique({ where: { id: campaign.instanceId } });
  if (!instance) {
    await prisma.campaign.update({ where: { id: campaign.id }, data: { status: 'PAUSED' } });
    activeCampaigns.delete(campaign.id);
    return;
  }

  const processLoop = async () => {
    while (true) {
      const fresh = await prisma.campaign.findUnique({ where: { id: campaign.id } });
      if (!fresh || fresh.status !== 'SENDING') {
        activeCampaigns.delete(campaign.id);
        return;
      }

      const hasMore = await processOneLead(fresh, instance);
      if (!hasMore) return;

      await randomDelay(campaign.delayMin, campaign.delayMax);
    }
  };

  processLoop().catch(err => {
    console.error(`Erro fatal na campanha ${campaign.id}:`, err);
    activeCampaigns.delete(campaign.id);
  });
}

async function pollCampaigns() {
  try {
    const campaigns = await prisma.campaign.findMany({ where: { status: 'SENDING' } });
    for (const campaign of campaigns) {
      if (!activeCampaigns.get(campaign.id)) {
        processCampaign(campaign);
      }
    }
  } catch (err) {
    console.error('Erro no polling de campanhas:', err);
  }
}

export function startCampaignWorker() {
  console.log('Campaign worker started (polling every 5s)');
  setInterval(pollCampaigns, POLL_INTERVAL);
  pollCampaigns();
}

export async function recoverFromCrash() {
  await prisma.instance.updateMany({ where: { busy: true }, data: { busy: false } });
  await prisma.lead.updateMany({ where: { status: 'SENDING' }, data: { status: 'PENDING' } });
  console.log('Crash recovery: reset busy flags and stale SENDING leads');
}
