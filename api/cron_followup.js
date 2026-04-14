// api/cron_followup.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ugsqqqswdnkhzzlcghcv.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_zcrh64N1Jb5bSn-Hs21d1A_bSp0_K9L';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey; 
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const UAZAPI_URL = process.env.UAZAPI_URL || 'https://flixstreaming.uazapi.com';
    const INSTANCE_ID = process.env.UAZAPI_INSTANCE || '56mMDx';
    const API_KEY = process.env.UAZAPI_TOKEN || '10b97f21-ae5d-43fd-b5f8-c57499c98537';

    try {
        // Buscar mensagens dinâmicas cadastradas no CRM
        let funnelTemplates = {};
        const { data: mensagensDb, error: errMsg } = await supabase.from('mensagens').select('*');
        if (!errMsg && mensagensDb) {
            mensagensDb.forEach(m => {
                funnelTemplates[m.chave.toUpperCase()] = {
                    text: m.texto,
                    url: m.midia_url
                };
            });
        }

        // Helper substituto inteligente de nomes e fallbacks
        function getMessageObj(chaveTemplate, defaultText, nameToSay) {
            const template = funnelTemplates[chaveTemplate];
            let text = defaultText;
            let url = null;
            
            if (template) {
                text = template.text.replace(/\{\{nome\}\}/gi, nameToSay);
                url = template.url ? template.url.trim() : null;
            } else {
                text = text.replace(/\{\{nome\}\}/gi, nameToSay);
            }
            return { text, url };
        }

        // Buscar leads
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .not('inicio_teste', 'is', null)
            .neq('comprou', 'Sim')
            .neq('comprou', 'Não')
            .neq('status', 'Ativo')
            .neq('status', 'Inativo');

        if (error) throw error;
        if (!leads || leads.length === 0) return res.status(200).json({ message: 'Nenhum lead elegível.' });

        const now = new Date();
        const messagesToSend = [];
        const updatesToMake = [];

        for (const lead of leads) {
            const inicio = new Date(lead.inicio_teste);
            const diffMs = now - inicio;
            const diffMinutos = Math.floor(diffMs / 60000);
            const diffHoras = diffMinutos / 60;
            const duracaoHoras = lead.duracao_teste || 4; 
            const followups = lead.followup_status || {};
            
            let nameToSay = (lead.nome || lead.name || 'Amigo(a)').split(' ')[0];
            let cleanPhone = (lead.whatsapp || lead.phone || lead.telefone || '').replace(/\D/g, '');

            if (!cleanPhone) continue;

            let messageToQueue = null;
            let followKey = null;

            if (diffHoras >= 168 && !followups['dia7']) {
                messageToQueue = getMessageObj('FUNIL-DIA7', `Olá ${nameToSay}! Só passando para avisar que é nossa última tentativa de contato. Ainda tem interesse no app?`, nameToSay);
                followKey = 'dia7';
            } else if (diffHoras >= 72 && !followups['dia3']) {
                messageToQueue = getMessageObj('FUNIL-DIA3', `Oi ${nameToSay}, tudo bem? Consigo te fazer uma condição super especial para fecharmos hoje! Me manda um OK.`, nameToSay);
                followKey = 'dia3';
            } else if (diffHoras >= 24 && !followups['dia1']) {
                messageToQueue = getMessageObj('FUNIL-DIA1', `Oi ${nameToSay}, como foi o dia ontem? Gostou do nosso IPTV? Ficou com alguma dúvida?`, nameToSay);
                followKey = 'dia1';
            } else if (diffHoras >= duracaoHoras && !followups['fim']) {
                messageToQueue = getMessageObj('FUNIL-FIM', `Seu teste VIP encerrou, ${nameToSay}! O que achou da grade de canais e filmes?`, nameToSay);
                followKey = 'fim';
            } else if (diffMinutos >= 30 && !followups['30m']) {
                messageToQueue = getMessageObj('FUNIL-30M', `E aí ${nameToSay}, conseguiu acessar os canais? Se precisar de ajuda para instalar, pode me chamar!`, nameToSay);
                followKey = '30m';
            }

            if (messageToQueue && followKey) {
                const newFollowups = { ...followups, [followKey]: true };
                
                let msgData = {
                    number: cleanPhone,
                    type: 'text',
                    text: messageToQueue.text
                };

                // Tratar mídia (imagem ou vídeo) dinamicamente pra uazapi
                if (messageToQueue.url) {
                    const lUrl = messageToQueue.url.toLowerCase();
                    if(lUrl.endsWith('.mp4')) msgData.type = 'video';
                    else if(lUrl.endsWith('.mp3') || lUrl.endsWith('.ogg')) msgData.type = 'audio';
                    else msgData.type = 'image';
                    
                    msgData.url = messageToQueue.url;
                }

                messagesToSend.push(msgData);
                updatesToMake.push({ id: lead.id, followup_status: newFollowups });
            }
        }

        if (messagesToSend.length > 0) {
            const response = await fetch(`${UAZAPI_URL}/sender/advanced`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': API_KEY, 'token': API_KEY, 'instance': INSTANCE_ID
                },
                body: JSON.stringify({
                    instance: INSTANCE_ID, delayMin: 15, delayMax: 30,
                    info: `crm-cron-funnel`, messages: messagesToSend, token: API_KEY
                })
            });
            if (!response.ok) throw new Error(await response.text());

            await Promise.all(updatesToMake.map(upd => 
                supabase.from('leads').update({ followup_status: upd.followup_status, updated_at: new Date() }).eq('id', upd.id)
            ));
            return res.status(200).json({ success: true, disparos: messagesToSend.length });
        }

        return res.status(200).json({ success: true, disparos: 0 });

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}
