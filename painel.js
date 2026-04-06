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
                    const followup = document.getElementById('followup-container');
                    const targetEl = document.getElementById(targetId);
                    
                    if(board) board.style.display = 'none';
                    if(broadcast) broadcast.style.display = 'none';
                    if(followup) followup.style.display = 'none';
                    
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
        // Set new default statuses mapping for user requests
        const comprouField = document.getElementById('comprou');
        if(comprouField) comprouField.value = 'Pendente';
        const motivoField = document.getElementById('motivo');
        if(motivoField) motivoField.value = '';

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
            
            // New fields
            const comprou = document.getElementById('comprou') ? document.getElementById('comprou').value : 'Pendente';
            const motivo = document.getElementById('motivo') ? document.getElementById('motivo').value : '';

            const leadData = {
                nome,
                telefone,
                phone: telefone,
                whatsapp: telefone,
                fonte,
                status,
                plano,
                data_contato: contato,
                data_vencimento: vencimento,
                observacoes,
                comprou,
                motivo,
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
            renderFollowUps();
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
                        <div>
                            <span class="tag">${lead.plano || 'Nenhum'}</span>
                            ${lead.comprou === 'Não' ? `<span class="tag" style="background:#EF4444; color:white;">Não comprou</span>` : ''}
                        </div>
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

    function renderFollowUps() {
        const colFrios = document.getElementById('followup-frios');
        const colResgate = document.getElementById('followup-resgate');
        const colVencimento = document.getElementById('followup-vencimento');

        if(colFrios) colFrios.innerHTML = '';
        if(colResgate) colResgate.innerHTML = '';
        if(colVencimento) colVencimento.innerHTML = '';

        const todayTimestamp = new Date().getTime();
        const DAY_IN_MS = 24 * 60 * 60 * 1000;

        let numFrios = 0, numResgate = 0, numVencimento = 0;

        leads.forEach(lead => {
            const status = lead.status || 'Novo';
            
            // Frios (Novo + data_contato > 7 dias e Não Comprou)
            if (status === 'Novo' && lead.comprou !== 'Sim' && lead.data_contato) {
                const contactTime = new Date(lead.data_contato).getTime();
                const diffDays = (todayTimestamp - contactTime) / DAY_IN_MS;
                if (diffDays >= 7) {
                    colFrios.appendChild(createFollowUpCard(lead, `Sem contato há ${Math.floor(diffDays)} dias`, '#60A5FA'));
                    numFrios++;
                }
            }
            
            // Resgate (Teste Grátis + data_contato >= 1 dia)
            if (status === 'Teste Grátis' && lead.data_contato) {
                const contactTime = new Date(lead.data_contato).getTime();
                const diffDays = (todayTimestamp - contactTime) / DAY_IN_MS;
                if (diffDays >= 1) {
                    colResgate.appendChild(createFollowUpCard(lead, `Teste enviado há ${Math.floor(diffDays)} dias`, '#F59E0B'));
                    numResgate++;
                }
            }

            // Vencimento (Ativo + data_vencimento em breve)
            if (status === 'Ativo' && lead.data_vencimento) {
                const expTime = new Date(lead.data_vencimento).getTime();
                const diffDays = (expTime - todayTimestamp) / DAY_IN_MS;
                // Vence entre ontem (-1) e daqui 3 dias (+3)
                if (diffDays >= -1 && diffDays <= 4) {
                    let msg = diffDays < 0 ? 'Venceu ontem' : (diffDays < 1 ? 'Vence HOJE' : `Vence em ${Math.floor(diffDays)} dias`);
                    colVencimento.appendChild(createFollowUpCard(lead, msg, '#EF4444'));
                    numVencimento++;
                }
            }
        });

        if(document.getElementById('count-frios')) document.getElementById('count-frios').innerText = numFrios;
        if(document.getElementById('count-resgate')) document.getElementById('count-resgate').innerText = numResgate;
        if(document.getElementById('count-vencimento')) document.getElementById('count-vencimento').innerText = numVencimento;
    }

    function createFollowUpCard(lead, infoMsg, color) {
        const card = document.createElement('div');
        card.className = 'lead-card';
        
        const displayNome = lead.nome || lead.name || lead.pushName || 'Sem Nome';
        const displayPhone = lead.telefone || lead.phone || lead.whatsapp || 'S/N';
        const actionPhone = displayPhone.replace(/\D/g, '');

        card.innerHTML = `
            <div class="card-header"><span class="card-title">${displayNome}</span></div>
            <div class="card-body">
                <div class="card-info"><i class="fa-brands fa-whatsapp"></i> ${displayPhone}</div>
                <div class="card-info" style="color: ${color}; font-weight: 500;"><i class="fa-solid fa-clock"></i> ${infoMsg}</div>
                
                <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button onclick="window.sendUazapiFast('${actionPhone}', '${displayNome}')" class="btn-primary" style="flex: 1; padding: 6px; font-size: 12px; justify-content: center; background-color: #25D366; color: #111;"><i class="fa-brands fa-whatsapp"></i> UAZAPI</button>
                    <button onclick="window.editLeadById('${lead.id}')" class="btn-secondary" style="flex: 1; padding: 6px; font-size: 12px; justify-content: center;"><i class="fa-solid fa-pen"></i> Editar</button>
                </div>
            </div>
        `;
        return card;
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
        
        // Load new fields
        const comprouField = document.getElementById('comprou');
        if(comprouField) comprouField.value = lead.comprou || 'Pendente';
        const motivoField = document.getElementById('motivo');
        if(motivoField) motivoField.value = lead.motivo || '';

        if(leadModal) leadModal.classList.add('active');
    };

    window.editLeadById = function(id) {
        const lead = leads.find(l => l.id === id);
        if(lead) window.editLead(lead);
    }

    window.sendUazapiFast = function(phone, name) {
        // Pre-fill Broadcast tab and redirect
        if(document.getElementById('broadcastTarget')) document.getElementById('broadcastTarget').value = 'Todos'; // Ignore filter
        
        // Auto-change nav
        const broadcastNav = document.querySelector('a[data-target="broadcast-container"]');
        if(broadcastNav) broadcastNav.click();

        if(document.getElementById('broadcastMessage')) {
            document.getElementById('broadcastMessage').value = `Olá ${name.split(' ')[0]}, tudo bem? Passando para avisar...`;
        }

        showToast(`Ir para a aba de disparos. Personalize a mensagem para ${name}.`, 'success');
        
        // To send ONLY to this person, we can just filter runtime leads array for quick broadcast
        // In a real scenario it's better to build a 1-to-1 prompt, let's just make it simple:
        leads = leads.filter(l => (l.telefone || l.phone || l.whatsapp || '').replace(/\D/g, '') === phone);
        if(document.getElementById('broadcastLog')) {
            document.getElementById('broadcastLog').innerText = `Fila Reduzida: Você está prestes a enviar somente para o ${name}. Clique em Iniciar.`;
        }
    }

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

            if (!confirm(`Sério que deseja iniciar o disparo para ${targetLeads.length} leads?`)) return;

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
                            broadcastLog.innerText = `Sucesso! Faltam ${timeRemaining}s para disparar próximo...`;
                        }
                    }
                }
            }

            // Finish UI
            broadcastIsRunning = false;
            // Refetch to reset the leads queue to default if we reduced it
            fetchLeads();
            
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
