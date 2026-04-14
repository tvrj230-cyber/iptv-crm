// State
let leads = [];
let dbMessages = [];
let dbClient = null;
let broadcastIsRunning = false;
let leadsPerDayChartInstance = null;
let leadsBySourceChartInstance = null;

function initApp() {
    // DOM Elements - Leads
    const addLeadBtn = document.getElementById('addLeadBtn');
    const leadModal = document.getElementById('leadModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const deleteLeadBtn = document.getElementById('deleteLeadBtn');
    const leadForm = document.getElementById('leadForm');
    
    // DOM Elements - Messages
    const addMessageBtn = document.getElementById('addMessageBtn');
    const messageModal = document.getElementById('messageModal');
    const closeMessageModalBtn = document.getElementById('closeMessageModalBtn');
    const cancelMessageBtn = document.getElementById('cancelMessageBtn');
    const deleteMessageBtn = document.getElementById('deleteMessageBtn');
    const messageForm = document.getElementById('messageForm');

    const toast = document.getElementById('toast');
    const navItems = document.querySelectorAll('.nav-item');
    const dataContato = document.getElementById('dataContato');
    const searchInput = document.getElementById('searchInput');

    // Broadcast & Import Elements 
    const startBroadcastBtn = document.getElementById('startBroadcastBtn');
    const stopBroadcastBtn = document.getElementById('stopBroadcastBtn');
    const broadcastTarget = document.getElementById('broadcastTarget');
    const broadcastMessage = document.getElementById('broadcastMessage');
    const broadcastProgressArea = document.getElementById('broadcastProgressArea');
    const csvFileInput = document.getElementById('csvFileInput');
    const processCsvBtn = document.getElementById('processCsvBtn');
    const importResult = document.getElementById('importResult');

    function showToast(message, type = 'success') {
        if(!toast) return;
        toast.innerText = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => { toast.className = 'toast'; }, 4000);
    }

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
                    const dashMetrics = document.getElementById('dashboard-metrics-container');
                    const broadcast = document.getElementById('broadcast-container');
                    const followup = document.getElementById('followup-container');
                    const importCont = document.getElementById('import-container');
                    const quickSendCont = document.getElementById('quick-send-container');
                    const testManagerCont = document.getElementById('test-manager-container');
                    const msgsCont = document.getElementById('messages-container');
                    
                    if(board) board.style.display = 'none';
                    if(dashMetrics) dashMetrics.style.display = 'none';
                    if(broadcast) broadcast.style.display = 'none';
                    if(followup) followup.style.display = 'none';
                    if(importCont) importCont.style.display = 'none';
                    if(quickSendCont) quickSendCont.style.display = 'none';
                    if(testManagerCont) testManagerCont.style.display = 'none';
                    if(msgsCont) msgsCont.style.display = 'none';
                    
                    const targetEl = document.getElementById(targetId);
                    if(targetEl) targetEl.style.display = 'block';
                }
            });
        });
    }

    // --- MESSAGES CRUD LOGIC ---
    function openMessageModal() {
        if(messageForm) messageForm.reset();
        if(document.getElementById('messageId')) document.getElementById('messageId').value = '';
        if(deleteMessageBtn) deleteMessageBtn.style.display = 'none';
        if(messageModal) messageModal.classList.add('active');
    }
    
    function closeMessageModal() {
        if(messageModal) messageModal.classList.remove('active');
    }

    if(addMessageBtn) addMessageBtn.addEventListener('click', openMessageModal);
    if(closeMessageModalBtn) closeMessageModalBtn.addEventListener('click', closeMessageModal);
    if(cancelMessageBtn) cancelMessageBtn.addEventListener('click', closeMessageModal);

    window.editMessage = function(id) {
        const msg = dbMessages.find(m => m.id === id);
        if(msg) {
            document.getElementById('messageId').value = msg.id;
            document.getElementById('msgChave').value = msg.chave || '';
            document.getElementById('msgTexto').value = msg.texto || '';
            document.getElementById('msgMidia').value = msg.midia_url || '';
            
            if(deleteMessageBtn) deleteMessageBtn.style.display = 'block';
            if(messageModal) messageModal.classList.add('active');
        }
    }

    if(deleteMessageBtn) {
        deleteMessageBtn.addEventListener('click', async () => {
            const id = document.getElementById('messageId').value;
            if (!id || !confirm('Excluir esta mensagem permanentemente?')) return;
            
            try {
                const { error } = await dbClient.from('mensagens').delete().eq('id', id);
                if (error) throw error;
                showToast('Mensagem excluída.', 'success');
                closeMessageModal();
                fetchMessages();
            } catch(e) {
                showToast(`Erro ao excluir: ${e.message}`, 'error');
            }
        });
    }

    if(messageForm) {
        messageForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = document.getElementById('messageId').value;
            const chave = document.getElementById('msgChave').value.trim();
            const texto = document.getElementById('msgTexto').value.trim();
            const midia_url = document.getElementById('msgMidia').value.trim() || null;
    
            if(!dbClient) return showToast('Sem conexão db', 'error');
            const dataObj = { chave, texto, midia_url };
    
            try {
                if(id) {
                    const { error } = await dbClient.from('mensagens').update(dataObj).eq('id', id);
                    if (error) throw error;
                    showToast('Mensagem atualizada!', 'success');
                } else {
                    const { error } = await dbClient.from('mensagens').insert([dataObj]);
                    if (error) throw error;
                    showToast('Mensagem salva com sucesso!', 'success');
                }
                closeMessageModal();
                fetchMessages();
            } catch(e) {
                showToast(`Erro Supabase: ${e.message}`, 'error');
            }
        });
    }

    async function fetchMessages() {
        try {
            const { data, error } = await dbClient.from('mensagens').select('*').order('created_at', { ascending: false });
            if (error) {
                if(error.code === '42P01') console.log('Tabela mensagens aguardando criação no Supabase.');
                else throw error;
            } else {
                dbMessages = data || [];
                renderMessages();
            }
        } catch(err) {
            console.error(err);
        }
    }

    function renderMessages() {
        const grid = document.getElementById('messagesGrid');
        if(!grid) return;
        grid.innerHTML = '';
        
        if(dbMessages.length === 0) {
            grid.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; grid-column: 1/-1;">Nenhuma mensagem customizada foi encontrada.</p>';
            return;
        }
    
        dbMessages.forEach(msg => {
            const card = document.createElement('div');
            card.className = "kpi-card";
            card.style = "flex-direction: column; align-items: stretch; justify-content: space-between;";
            
            const isFunnel = (msg.chave || '').startsWith('FUNIL');
            const iconColor = isFunnel ? '#8B5CF6' : 'var(--text-primary)';
            const mediaIcon = msg.midia_url ? '<i class="fa-solid fa-paperclip" style="color: var(--text-muted);"></i>' : '';
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <h3 style="font-size: 15px; color: ${iconColor}; font-weight: 600;"><i class="fa-solid fa-${isFunnel ? 'robot' : 'message'}"></i> ${msg.chave || 'S/N'}</h3>
                    ${mediaIcon}
                </div>
                <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; max-height: 60px;">${msg.texto}</p>
                <div style="margin-top: auto; display: flex; gap: 8px;">
                    <button onclick="window.editMessage('${msg.id}')" class="btn-secondary" style="flex: 1; padding: 6px; font-size: 13px; justify-content: center;"><i class="fa-solid fa-pen"></i> Editar</button>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    // --- LEADS MODAL & SETTINGS ---
    function openModal() {
        if(leadForm) leadForm.reset();
        const idField = document.getElementById('leadId');
        if(idField) idField.value = '';
        if(dataContato) dataContato.value = getTodayString();
        const comprouField = document.getElementById('comprou');
        if(comprouField) comprouField.value = 'Pendente';
        const motivoField = document.getElementById('motivo');
        if(motivoField) motivoField.value = '';

        if(deleteLeadBtn) deleteLeadBtn.style.display = 'none';
        if(leadModal) leadModal.classList.add('active');
    }

    function closeModal() {
        if(leadModal) leadModal.classList.remove('active');
    }

    if(addLeadBtn) addLeadBtn.addEventListener('click', openModal);
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if(deleteLeadBtn) {
        deleteLeadBtn.addEventListener('click', async () => {
            const id = document.getElementById('leadId') ? document.getElementById('leadId').value : null;
            if (!id || !confirm('Deseja excluir este Lead permanentemente?')) return;
            try {
                const { error } = await dbClient.from('leads').delete().eq('id', id);
                if (error) throw error;
                showToast('Lead excluído.', 'success');
                closeModal();
                fetchLeads();
            } catch (err) {
                showToast(`Erro ao excluir: ${err.message}`, 'error');
            }
        });
    }

    if(leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!dbClient) return showToast('Supabase não conectado!', 'error');

            const id = document.getElementById('leadId') ? document.getElementById('leadId').value : null;
            const nome = document.getElementById('nome').value;
            const telefone = document.getElementById('telefone').value;
            const leadData = {
                nome,
                phone: telefone,
                whatsapp: telefone,
                fonte: document.getElementById('fonte').value,
                status: document.getElementById('status').value,
                plano: document.getElementById('plano').value,
                data_contato: document.getElementById('dataContato').value,
                data_vencimento: document.getElementById('dataVencimento').value || null,
                observacoes: document.getElementById('observacoes').value,
                comprou: document.getElementById('comprou').value,
                motivo: document.getElementById('motivo').value,
                updated_at: new Date()
            };

            try {
                if (id) {
                    await dbClient.from('leads').update(leadData).eq('id', id);
                    showToast('Lead atualizado!', 'success');
                } else {
                    await dbClient.from('leads').insert([leadData]);
                    showToast('Lead adicionado!', 'success');
                }
                closeModal();
                fetchLeads();
            } catch (error) {
                showToast(`Erro: ${error.message}`, 'error');
            }
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            document.querySelectorAll('.lead-card').forEach(card => {
                card.style.display = card.innerText.toLowerCase().includes(term) ? 'block' : 'none';
            });
        });
    }

    async function fetchLeads() {
        try {
            const { data, error } = await dbClient.from('leads').select('*').order('created_at', { ascending: false });
            if (error) throw error;
            leads = data || [];
            renderKanban();
            renderFollowUps();
            renderDashboardMetrics();
            renderFunnel();
            // Carrega as mensagens
            fetchMessages();
        } catch (error) {
            showToast(`Erro ao carregar leads: ${error.message}`, 'error');
        }
    }

    function renderKanban() {
        const statuses = ['Novo', 'Leads Frios', 'Teste Grátis', 'Ativo', 'Vencido', 'Inativo'];
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

                card.innerHTML = `
                    <div class="card-header"><span class="card-title">${lead.nome || 'Sem Nome'}</span></div>
                    <div class="card-body">
                        <div class="card-info"><i class="fa-brands fa-whatsapp"></i> ${lead.telefone || lead.phone || lead.whatsapp || 'S/N'}</div>
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
            if(col) document.getElementById(`count-${status}`).innerText = col.children.length;
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
            if (status === 'Novo' && lead.comprou !== 'Sim' && lead.data_contato) {
                const diffDays = (todayTimestamp - new Date(lead.data_contato).getTime()) / DAY_IN_MS;
                if (diffDays >= 7 && colFrios) {
                    colFrios.appendChild(createFollowUpCard(lead, `Há ${Math.floor(diffDays)} dias`, '#60A5FA'));
                    numFrios++;
                }
            }
            if (status === 'Teste Grátis' && lead.data_contato) {
                const diffDays = (todayTimestamp - new Date(lead.data_contato).getTime()) / DAY_IN_MS;
                if (diffDays >= 1 && colResgate) {
                    colResgate.appendChild(createFollowUpCard(lead, `Há ${Math.floor(diffDays)} dias`, '#F59E0B'));
                    numResgate++;
                }
            }
            if (status === 'Ativo' && lead.data_vencimento) {
                const diffDays = (new Date(lead.data_vencimento).getTime() - todayTimestamp) / DAY_IN_MS;
                if (diffDays >= -1 && diffDays <= 4 && colVencimento) {
                    let msg = diffDays < 0 ? 'Venceu ontem' : (diffDays < 1 ? 'Vence HOJE' : `Em ${Math.floor(diffDays)} dias`);
                    colVencimento.appendChild(createFollowUpCard(lead, msg, '#EF4444'));
                    numVencimento++;
                }
            }
        });

        if(document.getElementById('count-frios')) document.getElementById('count-frios').innerText = numFrios;
        if(document.getElementById('count-resgate')) document.getElementById('count-resgate').innerText = numResgate;
        if(document.getElementById('count-vencimento')) document.getElementById('count-vencimento').innerText = numVencimento;
    }

    function renderDashboardMetrics() {
        if (!window.Chart) return;
        const totalLeads = leads.length;
        const ativos = leads.filter(l => l.status === 'Ativo').length;
        const compraram = leads.filter(l => l.comprou === 'Sim').length;
        
        let novosHoje = 0;
        const todayStr = getTodayString();
        leads.forEach(l => { if (l.data_contato === todayStr) novosHoje++; });

        const convRate = totalLeads > 0 ? ((compraram / totalLeads) * 100).toFixed(1) : 0;

        if (document.getElementById('kpi-total-leads')) document.getElementById('kpi-total-leads').innerText = totalLeads;
        if (document.getElementById('kpi-novos-hoje')) document.getElementById('kpi-novos-hoje').innerText = novosHoje;
        if (document.getElementById('kpi-ativos')) document.getElementById('kpi-ativos').innerText = ativos;
        if (document.getElementById('kpi-conversao')) document.getElementById('kpi-conversao').innerText = `${convRate}%`;

        const ctxPerDay = document.getElementById('leadsPerDayChart');
        if (ctxPerDay) {
            const datesMap = {};
            for(let i=13; i>=0; i--) { datesMap[new Date(Date.now() - i*86400000).toISOString().split('T')[0]] = 0; }
            leads.forEach(l => { if(datesMap[l.data_contato] !== undefined) datesMap[l.data_contato]++; });

            if (leadsPerDayChartInstance) leadsPerDayChartInstance.destroy();
            leadsPerDayChartInstance = new Chart(ctxPerDay, {
                type: 'line',
                data: { labels: Object.keys(datesMap).map(d=>d.split('-')[2]+'/'+d.split('-')[1]), datasets: [{ label: 'Novos', data: Object.values(datesMap), borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderWidth: 2, fill: true }] },
                options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display:false } } }
            });
        }
        const ctxSource = document.getElementById('leadsBySourceChart');
        if (ctxSource) {
            const sourceMap = {};
            leads.forEach(l => { const fonte = l.fonte || 'Indo'; sourceMap[fonte] = (sourceMap[fonte] || 0) + 1; });
            const sortedSources = Object.entries(sourceMap).sort((a,b) => b[1] - a[1]);

            if (leadsBySourceChartInstance) leadsBySourceChartInstance.destroy();
            leadsBySourceChartInstance = new Chart(ctxSource, {
                type: 'doughnut',
                data: { labels: sortedSources.map(s=>s[0]), datasets: [{ data: sortedSources.map(s=>s[1]), backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
            });
        }
    }

    function renderFunnel() {
        const select = document.getElementById('funnelSelectLead');
        const list = document.getElementById('funnelActiveList');
        if (!select || !list) return;

        select.innerHTML = '<option value="">-- Selecione o Lead --</option>';
        list.innerHTML = '';
        let hasActive = false;

        leads.forEach(l => {
            const isEligible = (l.comprou !== 'Sim' && l.comprou !== 'Não' && l.status !== 'Ativo' && l.status !== 'Inativo');
            if (isEligible && !l.inicio_teste) {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.innerText = `${l.nome || 'Sem Nome'} (${l.telefone || l.phone || l.whatsapp || 'S/N'})`;
                select.appendChild(opt);
            }
            if (l.inicio_teste && isEligible) {
                hasActive = true;
                const card = document.createElement('div');
                card.style = "padding: 15px; border-radius: 6px; background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.3); display: flex; justify-content: space-between; align-items: center;";
                const horas = Math.floor((new Date() - new Date(l.inicio_teste)) / 3600000);
                card.innerHTML = `
                    <div>
                        <strong>${l.nome || 'Sem Nome'}</strong> <span style="font-size: 12px; color: var(--text-muted);">(${l.phone || 'S/N'})</span><br>
                        <small style="color: #8B5CF6;"><i class="fa-solid fa-clock"></i> Robô roda há ${horas}h (Alvo: ${l.duracao_teste || 4}h)</small>
                    </div>
                    <button onclick="window.stopFunnel('${l.id}')" class="btn-secondary" style="font-size: 11px; padding: 5px 10px; border-color: #EF4444; color: #EF4444;"><i class="fa-solid fa-stop"></i> Parar</button>
                `;
                list.appendChild(card);
            }
        });

        if (!hasActive) list.innerHTML = '<div style="padding: 15px; border-radius: 6px; border: 1px dashed var(--border-color); text-align: center; color: var(--text-muted);">Nenhum lead sendo monitorado.</div>';
    }

    function createFollowUpCard(lead, infoMsg, color) {
        const card = document.createElement('div');
        card.className = 'lead-card';
        const displayNome = lead.nome || lead.name || 'Sem Nome';
        const displayPhone = lead.telefone || lead.phone || lead.whatsapp || 'S/N';
        
        card.innerHTML = `
            <div class="card-header"><span class="card-title">${displayNome}</span></div>
            <div class="card-body">
                <div class="card-info" style="color: ${color}; font-weight: 500;"><i class="fa-solid fa-clock"></i> ${infoMsg}</div>
                <div style="margin-top: 10px; display: flex; gap: 8px;">
                    <button onclick="window.sendUazapiFast('${displayPhone.replace(/\D/g, '')}', '${displayNome}')" class="btn-primary" style="flex:1; padding: 6px; font-size: 12px; background-color: #25D366;"><i class="fa-brands fa-whatsapp"></i> UAZAPI</button>
                    <button onclick="window.editLeadById('${lead.id}')" class="btn-secondary" style="flex:1; padding: 6px; font-size: 12px;"><i class="fa-solid fa-pen"></i> Editar</button>
                </div>
            </div>
        `;
        return card;
    }

    window.editLead = function(lead) {
        document.getElementById('leadId').value = lead.id;
        document.getElementById('nome').value = lead.nome || '';
        document.getElementById('telefone').value = lead.telefone || lead.phone || lead.whatsapp || '';
        document.getElementById('fonte').value = lead.fonte || 'Orgânico';
        document.getElementById('status').value = lead.status || 'Novo';
        document.getElementById('plano').value = lead.plano || 'Nenhum';
        if(deleteLeadBtn) deleteLeadBtn.style.display = 'block';
        if(leadModal) leadModal.classList.add('active');
    };
    
    window.editLeadById = function(id) { const lead = leads.find(l => l.id === id); if(lead) window.editLead(lead); }
    
    window.stopFunnel = async function(id) {
        if (!confirm('Deseja parar o robô para este lead?')) return;
        await dbClient.from('leads').update({ inicio_teste: null }).eq('id', id);
        fetchLeads();
    }
    
    window.sendUazapiFast = function(phone, name) {
        const broadcastNav = document.querySelector('a[data-target="broadcast-container"]');
        if(broadcastNav) broadcastNav.click();
    }

    const startFunnelBtn = document.getElementById('startFunnelBtn');
    if (startFunnelBtn) {
        startFunnelBtn.addEventListener('click', async () => {
            const leadId = document.getElementById('funnelSelectLead').value;
            if (!leadId) return;
            startFunnelBtn.disabled = true;
            try {
                await dbClient.from('leads').update({
                    inicio_teste: new Date().toISOString(),
                    duracao_teste: parseInt(document.getElementById('funnelTestDuration').value),
                    status: 'Teste Grátis', followup_status: {}
                }).eq('id', leadId);
                showToast('Funil Automático ativado!', 'success');
                fetchLeads();
            } catch (e) { showToast(`Erro: ${e.message}`, 'error'); } 
            finally { startFunnelBtn.disabled = false; }
        });
    }

    // Process Csv
    if (processCsvBtn) {
        processCsvBtn.addEventListener('click', async () => {
            if (!csvFileInput.files || csvFileInput.files.length === 0) return;
            const reader = new FileReader();
            reader.onload = async (e) => {
                const lines = e.target.result.split(/\r?\n/).filter(l => l.trim() !== '');
                const headers = lines[0].split(lines[0].includes(';') ? ';' : ',').map(h => h.trim().toLowerCase());
                const nameIdx = headers.findIndex(h => h.includes('nome'));
                const phoneIdx = headers.findIndex(h => h.includes('telefone') || h.includes('validação') || h.includes('celular') || h.includes('whatsapp') || h.includes('número'));
                
                const arrayToInsert = [];
                for (let i = 1; i < lines.length; i++) {
                    const cols = lines[i].split(lines[0].includes(';') ? ';' : ',').map(c => c.trim().replace(/^"|"$/g, ''));
                    const cleanPhone = (cols[phoneIdx]||'').replace(/\D/g, '');
                    if(cleanPhone.length >= 8) {
                        arrayToInsert.push({ nome: cols[nameIdx]||'', phone: cleanPhone, whatsapp: cleanPhone, status: 'Novo', comprou: 'Pendente' });
                    }
                }
                await dbClient.from('leads').insert(arrayToInsert);
                showToast(`Sucesso! ${arrayToInsert.length} leads salvos.`, 'success');
                fetchLeads();
            };
            reader.readAsText(csvFileInput.files[0]);
        });
    }
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initApp); } else { initApp(); }
