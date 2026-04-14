// api/cron_followup.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Vercel CRON or cron-job.org usually sends a GET request.
    // Allow both GET and POST for flexibility.

    // 1. Setup Supabase Client
    const supabaseUrl = process.env.SUPABASE_URL || 'https://ugsqqqswdnkhzzlcghcv.supabase.co';
    const supabaseKey = process.env.SUPABASE_KEY || 'sb_publishable_zcrh64N1Jb5bSn-Hs21d1A_bSp0_K9L'; // Pode ser ANON KEY se não houver RLS impedindo leitura/escrita
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseKey; // Ideal usar a service_role key no backend
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 2. Setup UAZAPI
    const UAZAPI_URL = process.env.UAZAPI_URL || 'https://flixstreaming.uazapi.com';
    const INSTANCE_ID = process.env.UAZAPI_INSTANCE || '56mMDx';
    const API_KEY = process.env.UAZAPI_TOKEN || '10b97f21-ae5d-43fd-b5f8-c57499c98537';

    try {
        // 3. Buscar leads elegíveis para o funil de teste
        // Regras: Tem "inicio_teste", não comprou (Sim/Não) e não está Ativo/Inativo.
        const { data: leads, error } = await supabase
            .from('leads')
            .select('*')
            .not('inicio_teste', 'is', null)
            .neq('comprou', 'Sim')
            .neq('comprou', 'Não')
            .neq('status', 'Ativo')
            .neq('status', 'Inativo');

        if (error) throw error;
        if (!leads || leads.length === 0) {
            return res.status(200).json({ message: 'Nenhum lead elegível no momento.' });
        }

        const now = new Date();
        const messagesToSend = [];
        const updatesToMake = [];

        // 4. Analisar as regras de tempo para cada lead
        for (const lead of leads) {
            const inicio = new Date(lead.inicio_teste);
            const diffMs = now - inicio;
            const diffMinutos = Math.floor(diffMs / 60000);
            const diffHoras = diffMinutos / 60;

            const duracaoHoras = lead.duracao_teste || 4; // default 4H se vazio
            const followups = lead.followup_status || {};
            
            let nameToSay = (lead.nome || lead.name || 'Amigo(a)').split(' ')[0];
            let cleanPhone = (lead.whatsapp || lead.phone || lead.telefone || '').replace(/\D/g, '');

            if (!cleanPhone) continue;

            let messageToQueue = null;
            let followKey = null;

            // Checagem do maior (dia 7) para o menor (30 min)
            if (diffHoras >= 168 && !followups['dia7']) {
                messageToQueue = `Olá ${nameToSay}! Só passando para avisar que é nossa última tentativa de contato. Ainda tem interesse no app?`;
                followKey = 'dia7';
            } else if (diffHoras >= 72 && !followups['dia3']) {
                messageToQueue = `Oi ${nameToSay}, tudo bem? Consigo te fazer uma condição super especial para fecharmos hoje! Me manda um OK.`;
                followKey = 'dia3';
            } else if (diffHoras >= 24 && !followups['dia1']) {
                messageToQueue = `Oi ${nameToSay}, como foi o dia ontem? Gostou do nosso IPTV? Ficou com alguma dúvida?`;
                followKey = 'dia1';
            } else if (diffHoras >= duracaoHoras && !followups['fim']) {
                messageToQueue = `Seu teste VIP encerrou, ${nameToSay}! O que achou da grade de canais e filmes? Dá uma olhada nos nossos planos mensais e anuais!`;
                followKey = 'fim';
            } else if (diffMinutos >= 30 && !followups['30m']) {
                messageToQueue = `E aí ${nameToSay}, conseguiu acessar os canais? Se precisar de ajuda para instalar, pode me chamar aqui!`;
                followKey = '30m';
            }

            // Se algo ativou, vamos salvar na fila
            if (messageToQueue && followKey) {
                // Atualizamos localmente a flag
                const newFollowups = { ...followups, [followKey]: true };
                
                messagesToSend.push({
                    number: cleanPhone,
                    type: 'text',
                    text: messageToQueue
                });

                updatesToMake.push({
                    id: lead.id,
                    followup_status: newFollowups
                });
            }
        }

        // 5. Se houver mensagens, enviamos para UAZAPI
        if (messagesToSend.length > 0) {
            const url = `${UAZAPI_URL}/sender/advanced`;
            const payload = {
                instance: INSTANCE_ID,
                delayMin: 15,
                delayMax: 30, // Delay seguro
                info: `crm-cron-funnel-${Date.now()}`,
                messages: messagesToSend,
                token: API_KEY
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': API_KEY,
                    'token': API_KEY,
                    'Authorization': `Bearer ${API_KEY}`,
                    'instance': INSTANCE_ID
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`UAZAPI falhou (${response.status}): ${err}`);
            }

            // 6. Atualizamos os status de followup no Supabase
            // Como Supabase JS não suporta Bulk Update facilmente de diferentes valores,
            // podemos iterar e fazer upsert ou Promise.all
            await Promise.all(updatesToMake.map(upd => 
                supabase.from('leads').update({ followup_status: upd.followup_status, updated_at: new Date() }).eq('id', upd.id)
            ));

            return res.status(200).json({ success: true, disparos: messagesToSend.length });
        }

        return res.status(200).json({ success: true, disparos: 0, message: 'Ninguém precisava de mensagem agora.' });

    } catch (error) {
        console.error('Erro no fluxo Cron:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
