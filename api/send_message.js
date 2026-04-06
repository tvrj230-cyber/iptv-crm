// api/send_message.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método não permitido (Use POST)' });
    }

    const { phone, message } = req.body;

    if (!phone || !message) {
        return res.status(400).json({ error: 'Número e mensagem são obrigatórios' });
    }

    // Configuração UAZAPI (Variáveis de Ambiente são prioridade se configuradas na Vercel)
    const UAZAPI_URL = process.env.UAZAPI_URL || 'https://flixstreaming.uazapi.com';
    const INSTANCE_ID = process.env.UAZAPI_INSTANCE || '56mMDx';
    const API_KEY = process.env.UAZAPI_TOKEN || '10b97f21-ae5d-43fd-b5f8-c57499c98537';

    const url = `${UAZAPI_URL}/sender/advanced`;

    try {
        const payload = {
            instance: INSTANCE_ID,
            delayMin: 4,
            delayMax: 8,
            info: "crm-ipvt-dispatch",
            scheduled_for: 1,
            messages: [
                {
                    number: phone, // "5511999999999"
                    type: "text",
                    text: message
                }
            ],
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
            throw new Error(`Erro na API: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        return res.status(200).json({ success: true, data });

    } catch (error) {
        console.error('Erro ao enviar mensagem:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
}
