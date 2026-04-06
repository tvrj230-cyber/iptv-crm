// State
let leads = [];
let dbClient = null;
let broadcastIsRunning = false;

function initApp() {
    // DOM Elements
    const addLeadBtn = document.getElementById('addLeadBtn');
    const leadModal = document.getElementById('leadModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const leadForm = document.getElementById('leadForm');
    const toast = document.getElementById('toast');
    const navItems = document.querySelectorAll('.nav-item');
    const dataContato = document.getElementById('dataContato');
    const searchInput = document.getElementById('searchInput');

    // Broadcast Elements
    const startBroadcastBtn = document.getElementById('startBroadcastBtn');
    const stopBroadcastBtn = document.getElementById('stopBroadcastBtn');
    const broadcastTarget = document.getElementById('broadcastTarget');
    const broadcastMessage = document.getElementById('broadcastMessage');
    const broadcastProgressArea = document.getElementById('broadcastProgressArea');
    const broadcastStatusText = document.getElementById('broadcastStatusText');
    const broadcastProgressBar = document.getElementById('broadcastProgressBar');
    const broadcastLog = document.getElementById('broadcastLog');

    // Toast Helper
    function showToast(message, type = 'success') {
        if(!toast) return;
        toast.innerText = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.className = 'toast'; }, 4000);
    }

    // Try Initializing Supabase
    try {
        const supabaseUrl = 'https://ugsqqqswdnkhzzlcghcv.supabase.co';
        const supabaseKey = 'sb_publishable_zcrh64N1Jb5bSn-Hs21d1A_bSp0_K9L';
        if (window.supabase) {
            dbClient = window.supabase.createClient(supabaseUrl, supabaseKey);
        } else {
            showToast('Erro: Biblioteca do Supabase não foi carregada.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Erro de inicialização do Supabase', 'error');
    }

    // Set Default Date helper
    function getTodayString() {
        return new Date().toISOString().split('T')[0];
    }

    if(dataContato) dataContato.value = getTodayString();

    if (dbClient) {
        fetchLeads();
    }

    // Navigation links
    if (navItems && navItems.length > 0) {
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                navItems.forEach(n => n.classList.remove('active'));
                item.classList.add('active');
                
                const targetId = item.getAttribute('data-target');
                if(targetId) {
                    const board = document.getElementById('board-container');
                    const broadcast = document.getElementById('broadcast-container');
                    const targetEl = document.getElementById(targetId);
                    
                    if(board) board.style.display = 'none';
                    if(broadcast) broadcast.style.display = 'none';
                    if(targetEl) targetEl.style.display = 'block';
                }
            });
        });
    }

    // Modal Logic
    function openModal() {
        if(leadForm) leadForm.reset();
        const idField = document.getElementById('leadId');
        if(idField) idField.value = '';
        if(dataContato) dataContato.value = getTodayString();
        if(leadModal) leadModal.classList.add('active');
    }

    function closeModal() {
        if(leadModal) leadModal.classList.remove('active');
    }

    if(addLeadBtn) addLeadBtn.addEventListener('click', openModal);
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Form logic
    if(leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!dbClient) {
                showToast('Supabase não conectado!', 'error');
                return;
            }

            const id = document.getElementById('leadId') ? document.getElementById('leadId').value : null;
            const nome = document.getElementById('nome') ? document.getElementById('nome').value : '';
            const telefone = document.getElementById('telefone') ? document.getElementById('telefone').value : '';
            const fonte = document.getElementById('fonte') ? document.getElementById('fonte').value : '';
            const status = document.getElementById('status') ? document.getElementById('status').value : '';
            const plano = document.getElementById('plano') ? document.getElementById('plano').value : '';
            const contato = document.getElementById('dataContato') ? document.getElementById('dataContato').value : '';
            const vencimento = document.getElementById('dataVencimento') ? (document.getElementById('dataVencimento').value || null) : null;
            const observacoes = document.getElementById('observacoes') ? document.getElementById('observacoes').value : '';

            const leadData = {
                nome,
                telefone,
                phone: telefone, // fallback for chatbot
                whatsapp: telefone, // fallback for chatbot
                fonte,
                status,
                plano,
                data_contato: contato,
                data_vencimento: vencimento,
                observacoes,
                updated_at: new Date()
            };

            try {
                if (id) {
                    const { error } = await dbClient.from('leads').update(leadData).eq('id', id);
                    if (error) throw error;
                    showToast('Lead atualizado com sucesso!', 'success');
                } else {
                    const { error } = await dbClient.from('leads').insert([leadData]);
                    if (error) throw error;
                    showToast('Lead adicionado com sucesso!', 'success');
                }
                closeModal();
                fetchLeads();
            } catch (error) {
                console.error(error);
                showToast(`Erro Supabase: ${error.message || 'Falha ao salvar'}`, 'error');
            }
        });
    }

    // Search Logic
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.lead-card').forEach(card => {
                card.style.display = card.innerText.toLowerCase().includes(term) ? 'block' : 'none';
            });
        });
    }

    // Fetch and Render
    async function fetchLeads() {
        try {
            const { data, error } = await dbClient
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false });
            if (error) throw error;
            leads = data || [];
            renderKanban();
        } catch (error) {
            console.error(error);
            showToast(`Erro ao carregar: ${error.message}`, 'error');
        }
    }

    function renderKanban() {
        const statuses = ['Novo', 'Teste Grátis', 'Ativo', 'Vencido', 'Inativo'];
        
        statuses.forEach(status => {
            const column = document.getElementById(`column-${status}`);
            if(column) {
                column.innerHTML = '';
                const countEl = document.getElementById(`count-${status}`);
                if (countEl) countEl.innerText = '0';
            }
        });

        leads.forEach(lead => {
            const status = lead.status || 'Novo';
            const column = document.getElementById(`column-${status}`);
            
            if (column) {
                const card = document.createElement('div');
                card.className = 'lead-card';
                card.onclick = () => window.editLead(lead);

                let dateStr = 'Sem data';
                if(lead.data_contato) {
                    const parts = lead.data_contato.split('-');
                    if(parts.length === 3) dateStr = `${parts[2]}/${parts[1]}/${parts[0]}`;
                }

                const displayNome = lead.nome || lead.name || lead.pushName || 'Sem Nome';
                const displayPhone = lead.telefone || lead.phone || lead.whatsapp || 'S/N';

                card.innerHTML = `
                    <div class="card-header"><span class="card-title">${displayNome}</span></div>
                    <div class="card-body">
                        <div class="card-info"><i class="fa-brands fa-whatsapp"></i> ${displayPhone}</div>
                        <div class="card-info"><i class="fa-regular fa-calendar"></i> ${dateStr}</div>
                        <div><span class="tag">${lead.plano || 'Nenhum'}</span></div>
                    </div>
                `;
                column.appendChild(card);
            }
        });

        statuses.forEach(status => {
            const col = document.getElementById(`column-${status}`);
            if(col) {
                document.getElementById(`count-${status}`).innerText = col.children.length;
            }
        });
    }

    // Make editLead globally available for onclick inside HTML string
    window.editLead = function(lead) {
        document.getElementById('leadId').value = lead.id;
        document.getElementById('nome').value = lead.nome || lead.name || lead.pushName || '';
        document.getElementById('telefone').value = lead.telefone || lead.phone || lead.whatsapp || '';
        document.getElementById('fonte').value = lead.fonte || 'Orgânico';
        document.getElementById('status').value = lead.status || 'Novo';
        document.getElementById('plano').value = lead.plano || 'Nenhum';
        document.getElementById('dataContato').value = lead.data_contato || '';
        document.getElementById('dataVencimento').value = lead.data_vencimento || '';
        document.getElementById('observacoes').value = lead.observacoes || '';
        if(leadModal) leadModal.classList.add('active');
    };

    // --- BROADCAST LOGIC ---
    if (startBroadcastBtn) {
        startBroadcastBtn.addEventListener('click', async () => {
            if (broadcastIsRunning) return;

            const target = broadcastTarget ? broadcastTarget.value : 'Todos';
            let rawMessage = broadcastMessage ? broadcastMessage.value.trim() : '';

            if (!rawMessage) {
                showToast('A mensagem não pode estar vazia.', 'error');
                return;
            }

            // Filter leads
            let targetLeads = leads;
            if (target !== 'Todos') {
                targetLeads = leads.filter(l => (l.status || 'Novo') === target);
            }

            if (targetLeads.length === 0) {
                showToast('Nenhum lead encontrado com esse filtro.', 'error');
                return;
            }

            if (!confirm(`Sério que deseja iniciar o disparo para ${targetLeads.length} leads? Lembre-se de manter esta aba aberta!`)) return;

            // Start UI
            broadcastIsRunning = true;
            if(startBroadcastBtn) startBroadcastBtn.style.display = 'none';
            if(stopBroadcastBtn) stopBroadcastBtn.style.display = 'inline-block';
            if(broadcastProgressArea) broadcastProgressArea.style.display = 'block';

            let count = 0;
            const total = targetLeads.length;

            for (let i = 0; i < total; i++) {
                if (!broadcastIsRunning) {
                    if(broadcastLog) broadcastLog.innerText = 'Disparo abortado pelo usuário.';
                    break;
                }

                const lead = targetLeads[i];
                const leadName = lead.nome || lead.name || lead.pushName || 'Amigo(a)';
                const leadPhone = lead.telefone || lead.phone || lead.whatsapp || '';

                if (!leadPhone) {
                    if(broadcastLog) broadcastLog.innerText = `Pulando contato sem número... (${leadName})`;
                    continue;
                }

                // Parse message variables
                const personalizedMessage = rawMessage.replace(/\{\{nome\}\}/gi, leadName.split(' ')[0]);

                count++;
                if(broadcastProgressBar) broadcastProgressBar.style.width = `${(count / total) * 100}%`;
                if(broadcastStatusText) broadcastStatusText.innerText = `Enviando... (${count}/${total})`;
                if(broadcastLog) broadcastLog.innerText = `Enviando para ${leadName} (${leadPhone}). Aguarde...`;

                try {
                    // Call Vercel API
                    const apiUrl = window.location.protocol === 'file:' ? 'http://localhost:3000/api/send_message' : '/api/send_message';

                    const res = await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ phone: leadPhone, message: personalizedMessage })
                    });
                    
                    if (!res.ok) {
                        const err = await res.text();
                        console.error("Vercel API Erro:", err);
                    }
                } catch (err) {
                    console.error("Fetch falhou:", err);
                }

                if (i < total - 1) {
                    // Wait 90 seconds (90000 ms) before next IF not last
                    let timeRemaining = 90;
                    if(broadcastLog) broadcastLog.innerText = `Sucesso para ${leadName}! Aguardando 90 segundos...`;
                    
                    for (let sec = 0; sec < 90; sec++) {
                        if (!broadcastIsRunning) break;
                        await new Promise(r => setTimeout(r, 1000));
                        timeRemaining--;
                        if (timeRemaining % 5 === 0 && broadcastLog) {
                            broadcastLog.innerText = `Sucesso! Faltam ${timeRemaining}s para iniciar o próximo disparo...`;
                        }
                    }
                }
            }

            // Finish UI
            broadcastIsRunning = false;
            if(startBroadcastBtn) startBroadcastBtn.style.display = 'inline-block';
            if(stopBroadcastBtn) stopBroadcastBtn.style.display = 'none';
            
            if (count === total) {
                if(broadcastStatusText) broadcastStatusText.innerText = `Concluído! (${count}/${total})`;
                if(broadcastLog) broadcastLog.innerText = 'Disparo finalizado com sucesso.';
                showToast('Todos os disparos foram realizados!', 'success');
            }
        });
    }

    if (stopBroadcastBtn) {
        stopBroadcastBtn.addEventListener('click', () => {
            broadcastIsRunning = false;
            showToast('Pausando os disparos...', 'error');
            if(stopBroadcastBtn) stopBroadcastBtn.style.display = 'none';
            if(startBroadcastBtn) {
                startBroadcastBtn.style.display = 'inline-block';
                startBroadcastBtn.innerText = 'Continuar Disparo';
            }
        });
    }
}

// Ensure execution at the right time
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
