// api/broadcast.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido (Use POST)' });
    }

    // req.body.messages should be an array like: [ { phone: '123', message: 'Hello' }, ... ]
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: 'Lista de mensagens inválida ou vazia.' });
    }

    // Configuração UAZAPI (Variáveis de Ambiente são prioridade se configuradas na Vercel)
    const UAZAPI_URL = process.env.UAZAPI_URL || 'https://flixstreaming.uazapi.com';
    const INSTANCE_ID = process.env.UAZAPI_INSTANCE || '56mMDx';
    const API_KEY = process.env.UAZAPI_TOKEN || '10b97f21-ae5d-43fd-b5f8-c57499c98537';

    const url = `${UAZAPI_URL}/sender/advanced`;

    try {
        // Mapear o formato do frontend para o formato aceito pela UAZAPI
        const uazapiMessages = messages.map(msg => ({
            number: msg.phone,
            type: "text",
            text: msg.message
        }));

        const payload = {
            instance: INSTANCE_ID,
            delayMin: 15,
            delayMax: 30, // Entre 15s e 30s de intervalo pra evitar banimento com a fila massiva
            info: `crm-broadcast-dispatch-${Date.now()}`,
            messages: uazapiMessages,
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
            const errorText = await response.text();
            throw new Error(`Erro na API (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        // Retorna sucesso para que a Vercel encerre a função imediatamente,
        // enquanto a UAZAPI toma posse da gestão da fila baseada no payload.
        return res.status(200).json({ success: true, data });

    } catch (error) {
        console.error('Erro ao processar broadcast em massa:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
