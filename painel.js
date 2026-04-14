// State
let leads = [];
let dbClient = null;
let broadcastIsRunning = false;
let leadsPerDayChartInstance = null;
let leadsBySourceChartInstance = null;

function initApp() {
    // DOM Elements
    const addLeadBtn = document.getElementById('addLeadBtn');
    const leadModal = document.getElementById('leadModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    const deleteLeadBtn = document.getElementById('deleteLeadBtn');
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

    // Import Elements
    const csvFileInput = document.getElementById('csvFileInput');
    const processCsvBtn = document.getElementById('processCsvBtn');
    const importResult = document.getElementById('importResult');
    const importStatusTarget = document.getElementById('importStatusTarget');

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
                    const dashMetrics = document.getElementById('dashboard-metrics-container');
                    const broadcast = document.getElementById('broadcast-container');
                    const followup = document.getElementById('followup-container');
                    const importCont = document.getElementById('import-container');
                    const quickSendCont = document.getElementById('quick-send-container');
                    const testManagerCont = document.getElementById('test-manager-container');
                    const targetEl = document.getElementById(targetId);
                    
                    if(board) board.style.display = 'none';
                    if(dashMetrics) dashMetrics.style.display = 'none';
                    if(broadcast) broadcast.style.display = 'none';
                    if(followup) followup.style.display = 'none';
                    if(importCont) importCont.style.display = 'none';
                    if(quickSendCont) quickSendCont.style.display = 'none';
                    if(testManagerCont) testManagerCont.style.display = 'none';
                    
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

        if(deleteLeadBtn) deleteLeadBtn.style.display = 'none';
        if(leadModal) leadModal.classList.add('active');
    }

    function closeModal() {
        if(leadModal) leadModal.classList.remove('active');
    }

    if(addLeadBtn) addLeadBtn.addEventListener('click', openModal);
    if(closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if(cancelBtn) cancelBtn.addEventListener('click', closeModal);

    // Delete Logic
    if(deleteLeadBtn) {
        deleteLeadBtn.addEventListener('click', async () => {
            const id = document.getElementById('leadId') ? document.getElementById('leadId').value : null;
            if (!id) return;
            
            if (!confirm('Você tem certeza absoluta que deseja excluir este Lead permanentemente?')) {
                return;
            }

            if (!dbClient) {
                showToast('Supabase não conectado!', 'error');
                return;
            }

            try {
                const { error } = await dbClient.from('leads').delete().eq('id', id);
                if (error) throw error;
                showToast('Lead excluído com sucesso.', 'success');
                closeModal();
                fetchLeads();
            } catch (err) {
                console.error(err);
                showToast(`Erro ao excluir: ${err.message}`, 'error');
            }
        });
    }

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
            renderDashboardMetrics();
            renderFunnel();
        } catch (error) {
            console.error(error);
            showToast(`Erro ao carregar: ${error.message}`, 'error');
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

    function renderDashboardMetrics() {
        if (!window.Chart) return; // Prevent errors before Chart.js loads

        // --- 1. Calcular KPIs ---
        const totalLeads = leads.length;
        const ativos = leads.filter(l => l.status === 'Ativo').length;
        const compraram = leads.filter(l => l.comprou === 'Sim').length;
        
        let novosHoje = 0;
        const todayStr = getTodayString();
        leads.forEach(l => {
            if (l.data_contato === todayStr) novosHoje++;
        });

        const convRate = totalLeads > 0 ? ((compraram / totalLeads) * 100).toFixed(1) : 0;

        if (document.getElementById('kpi-total-leads')) document.getElementById('kpi-total-leads').innerText = totalLeads;
        if (document.getElementById('kpi-novos-hoje')) document.getElementById('kpi-novos-hoje').innerText = novosHoje;
        if (document.getElementById('kpi-ativos')) document.getElementById('kpi-ativos').innerText = ativos;
        if (document.getElementById('kpi-conversao')) document.getElementById('kpi-conversao').innerText = `${convRate}%`;

        // --- 2. Chart: Volume de Leads por Dia (Últimos 14 dias) ---
        const ctxPerDay = document.getElementById('leadsPerDayChart');
        if (ctxPerDay) {
            // Generates last 14 dates to ensure empty days appear
            const datesMap = {};
            for(let i=13; i>=0; i--) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                const isoStr = d.toISOString().split('T')[0];
                datesMap[isoStr] = 0;
            }

            leads.forEach(l => {
                if(l.data_contato && datesMap[l.data_contato] !== undefined) {
                    datesMap[l.data_contato]++;
                }
            });

            const labelsDay = Object.keys(datesMap).map(d => {
                const parts = d.split('-');
                return `${parts[2]}/${parts[1]}`;
            });
            const dataDay = Object.values(datesMap);

            if (leadsPerDayChartInstance) leadsPerDayChartInstance.destroy();

            leadsPerDayChartInstance = new Chart(ctxPerDay, {
                type: 'line',
                data: {
                    labels: labelsDay,
                    datasets: [{
                        label: 'Novos Leads',
                        data: dataDay,
                        borderColor: '#3B82F6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { beginAtZero: true, grid: { color: '#2A3143' }, ticks: { stepSize: 1 } },
                        x: { grid: { display: false } }
                    }
                }
            });
        }

        // --- 3. Chart: Melhores Fontes (Doughnut) ---
        const ctxSource = document.getElementById('leadsBySourceChart');
        if (ctxSource) {
            const sourceMap = {};
            leads.forEach(l => {
                const fonte = l.fonte || 'Desconhecido';
                sourceMap[fonte] = (sourceMap[fonte] || 0) + 1;
            });

            // Sort sources by amount
            const sortedSources = Object.entries(sourceMap).sort((a,b) => b[1] - a[1]);
            const sourceLabels = sortedSources.map(s => s[0]);
            const sourceData = sortedSources.map(s => s[1]);

            if (leadsBySourceChartInstance) leadsBySourceChartInstance.destroy();

            leadsBySourceChartInstance = new Chart(ctxSource, {
                type: 'doughnut',
                data: {
                    labels: sourceLabels,
                    datasets: [{
                        label: 'Total de Leads',
                        data: sourceData,
                        backgroundColor: [
                            '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#EC4899', '#6B7280'
                        ],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#F3F4F6' } }
                    },
                    cutout: '65%'
                }
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
            // Regra de inelegilidade: Comprou, Nao Comprou, Ativo ou Inativo = nao recebe funil
            const isEligible = (l.comprou !== 'Sim' && l.comprou !== 'Não' && l.status !== 'Ativo' && l.status !== 'Inativo');
            
            if (isEligible && !l.inicio_teste) {
                const opt = document.createElement('option');
                opt.value = l.id;
                opt.innerText = `${l.nome || 'Sem Nome'} (${l.phone || 'S/N'})`;
                select.appendChild(opt);
            }

            if (l.inicio_teste && isEligible) {
                hasActive = true;
                const card = document.createElement('div');
                card.style = "padding: 15px; border-radius: 6px; background: rgba(139, 92, 246, 0.05); border: 1px solid rgba(139, 92, 246, 0.3); display: flex; justify-content: space-between; align-items: center;";
                
                const start = new Date(l.inicio_teste);
                const now = new Date();
                const horas = Math.floor((now - start) / 3600000);
                
                card.innerHTML = `
                    <div>
                        <strong>${l.nome || 'Sem Nome'}</strong> <span style="font-size: 12px; color: var(--text-muted);">(${l.phone || 'S/N'})</span><br>
                        <small style="color: #8B5CF6;"><i class="fa-solid fa-clock"></i> Robô roda há ${horas}h (Alvo Duração: ${l.duracao_teste || 4}h)</small>
                    </div>
                    <div>
                        <button onclick="window.stopFunnel('${l.id}')" class="btn-secondary" style="font-size: 11px; padding: 5px 10px; border-color: #EF4444; color: #EF4444;"><i class="fa-solid fa-stop"></i> Parar Máquina</button>
                    </div>
                `;
                list.appendChild(card);
            }
        });

        if (!hasActive) {
            list.innerHTML = '<div style="padding: 15px; border-radius: 6px; border: 1px dashed var(--border-color); text-align: center; color: var(--text-muted);">Nenhum lead sendo monitorado.</div>';
        }
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

        if(deleteLeadBtn) deleteLeadBtn.style.display = 'block';
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

    // --- CSV IMPORT LOGIC ---
    if (processCsvBtn) {
        processCsvBtn.addEventListener('click', async () => {
            if (!csvFileInput || !csvFileInput.files || csvFileInput.files.length === 0) {
                showToast('Selecione um arquivo CSV primeiro.', 'error');
                return;
            }

            const file = csvFileInput.files[0];
            const reader = new FileReader();

            processCsvBtn.disabled = true;
            processCsvBtn.innerText = 'Processando...';
            importResult.style.display = 'none';

            reader.onload = async (e) => {
                try {
                    const text = e.target.result;
                    // Split lines handling \r\n or \n
                    const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
                    if (lines.length < 2) {
                        throw new Error("Arquivo vazio ou sem cabeçalhos.");
                    }

                    // Discover delimiter (virgula ou ponto-e-virgula)
                    const firstLine = lines[0];
                    const delimiter = firstLine.includes(';') ? ';' : ',';

                    const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
                    
                    // Encontrar a posição ("index") da coluna nome e da coluna telefone
                    const nameIdx = headers.findIndex(h => h.includes('nome') || h.includes('name'));
                    let phoneIdx = headers.findIndex(h => h.includes('telefone') || h.includes('phone') || h.includes('celular') || h.includes('whatsapp') || h.includes('número') || h.includes('numero'));

                    if (nameIdx === -1 || phoneIdx === -1) {
                         throw new Error(`Não consegui identificar as colunas de "Nome" ou "Telefone". Cabeçalhos encontrados: ${headers.join(', ')}`);
                    }

                    const arrayToInsert = [];
                    const todayStr = getTodayString();
                    
                    const destinationStatus = importStatusTarget ? importStatusTarget.value : 'Novo';

                    for (let i = 1; i < lines.length; i++) {
                        const cols = lines[i].split(delimiter).map(c => c.trim().replace(/^"|"$/g, '')); // remove quoted strings if exist
                        
                        const contatoNome = cols[nameIdx] || 'S/N';
                        const contatoPhone = cols[phoneIdx] || '';

                        // Limpar o telefone deixando apenas numeros
                        const cleanPhone = contatoPhone.replace(/\D/g, '');
                        if(cleanPhone.length < 8) continue; // Pula se n for um num valido minimamente

                        arrayToInsert.push({
                            nome: contatoNome,
                            phone: cleanPhone,
                            whatsapp: cleanPhone,
                            fonte: 'Importação CSV',
                            status: destinationStatus,
                            plano: 'Nenhum',
                            comprou: 'Pendente',
                            motivo: '',
                            data_contato: todayStr,
                            updated_at: new Date()
                        });
                    }

                    if(arrayToInsert.length === 0) {
                        throw new Error("Nenhum contato válido encontrado com números de telefone.");
                    }

                    // Tentar submeter em lote para o Supabase
                    const { error } = await dbClient.from('leads').insert(arrayToInsert);
                    if(error) throw error;

                    // Sucesso
                    showToast(`${arrayToInsert.length} leads importados com sucesso!`, 'success');
                    importResult.style.display = 'block';
                    importResult.style.color = '#2E7D32';
                    importResult.style.borderColor = '#25D366';
                    importResult.style.backgroundColor = 'rgba(37, 211, 102, 0.1)';
                    importResult.innerHTML = `<strong>Sucesso!</strong> Foram importados <b>${arrayToInsert.length}</b> novos contatos que já estão aguardando você na aba "Dashboard".`;
                    csvFileInput.value = ''; // clean input
                    
                    fetchLeads(); // Reload
                } catch(error) {
                    showToast(`Erro na importação: ${error.message}`, 'error');
                    importResult.style.display = 'block';
                    importResult.style.color = '#EF4444';
                    importResult.style.borderColor = '#EF4444';
                    importResult.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                    importResult.innerHTML = `<strong>Erro!</strong> ${error.message}`;
                } finally {
                    processCsvBtn.disabled = false;
                    processCsvBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Importar e Salvar Leads';
                }
            };

            reader.readAsText(file);
        });
    }

    // --- FUNNEL / TEST START LOGIC ---
    const startFunnelBtn = document.getElementById('startFunnelBtn');
    if (startFunnelBtn) {
        startFunnelBtn.addEventListener('click', async () => {
            const leadId = document.getElementById('funnelSelectLead').value;
            const duracao = document.getElementById('funnelTestDuration').value;

            if (!leadId) return showToast('Selecione um lead primeiro!', 'error');
            if (!dbClient) return showToast('Supabase não conectado!', 'error');

            try {
                startFunnelBtn.disabled = true;
                startFunnelBtn.innerText = 'Ativando...';

                // Tenta ativar a flag
                const { error } = await dbClient.from('leads').update({
                    inicio_teste: new Date().toISOString(),
                    duracao_teste: parseInt(duracao),
                    status: 'Teste Grátis',
                    followup_status: {} // Reinicia o painel do status de envios
                }).eq('id', leadId);

                // AVISO IMPORTANTE: Se o Supabase do usuário não tiver as colunas inicio_teste, duracao_teste, followup_status, vai estourar erro
                if (error) throw error;

                showToast('Funil Automático ativado para esse Lead! A primeira mensagem chegará em 30 min.', 'success');
                fetchLeads();
            } catch (e) {
                console.error(e);
                showToast(`Se o erro for sobre "column does not exist", execute no SQL do Supabase! Detalhe: ${e.message}`, 'error');
            } finally {
                startFunnelBtn.disabled = false;
                startFunnelBtn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Máquina';
            }
        });
    }

    // Global Stop Funnel
    window.stopFunnel = async function(id) {
        if (!confirm('Deseja cancelar o acompanhamento automático do robô para este lead?')) return;
        try {
            const { error } = await dbClient.from('leads').update({ inicio_teste: null }).eq('id', id);
            if (error) throw error;
            showToast('Robô interrompido com sucesso.', 'success');
            fetchLeads();
        } catch (e) {
            showToast(`Erro: ${e.message}`, 'error');
        }
    }

    // --- QUICK SEND (AVULSO) LOGIC ---
    const quickSendNumbers = document.getElementById('quickSendNumbers');
    const quickSendMessage = document.getElementById('quickSendMessage');
    const countValidNumbers = document.getElementById('countValidNumbers');
    const countInvalidNumbers = document.getElementById('countInvalidNumbers');
    const validNumbersList = document.getElementById('validNumbersList');
    const invalidNumbersList = document.getElementById('invalidNumbersList');
    const startQuickSendBtn = document.getElementById('startQuickSendBtn');

    let validNumbersArray = [];

    if (quickSendNumbers) {
        quickSendNumbers.addEventListener('input', () => {
            const text = quickSendNumbers.value;
            // Split by comma, newline or space
            const rawItems = text.split(/[\n,\s]+/).filter(i => i.trim() !== '');
            
            validNumbersArray = [];
            const invalidNumbersArray = [];

            rawItems.forEach(item => {
                const clean = item.replace(/\D/g, '');
                if (clean.length >= 10 && clean.length <= 15) {
                    validNumbersArray.push(clean);
                } else {
                    invalidNumbersArray.push(item);
                }
            });

            // Deduplicate valid
            validNumbersArray = [...new Set(validNumbersArray)];

            if(countValidNumbers) countValidNumbers.innerText = validNumbersArray.length;
            if(countInvalidNumbers) countInvalidNumbers.innerText = invalidNumbersArray.length;
            
            if(validNumbersList) validNumbersList.innerHTML = validNumbersArray.join('<br>') || 'Nenhum';
            if(invalidNumbersList) invalidNumbersList.innerHTML = invalidNumbersArray.join('<br>') || 'Nenhum';
        });
    }

    if (startQuickSendBtn) {
        startQuickSendBtn.addEventListener('click', async () => {
            if (validNumbersArray.length === 0) {
                showToast('Não há números válidos para envio.', 'error');
                return;
            }

            const rawMsg = quickSendMessage ? quickSendMessage.value.trim() : '';
            if (!rawMsg) {
                showToast('A mensagem não pode estar vazia.', 'error');
                return;
            }

            if (!confirm(`Deseja enviar a mensagem para os ${validNumbersArray.length} números válidos da lista? (Eles serão processados em 2º plano)`)) return;

            startQuickSendBtn.disabled = true;
            startQuickSendBtn.innerText = 'Enviando p/ Fila...';

            const payloadArr = validNumbersArray.map(phone => ({
                phone: phone,
                message: rawMsg
            }));

            const delayInput = document.getElementById('quickSendDelay') ? document.getElementById('quickSendDelay').value : '15-30';
            const [delayMin, delayMax] = delayInput.split('-').map(Number);

            try {
                const apiUrl = window.location.protocol === 'file:' ? 'http://localhost:3000/api/broadcast' : '/api/broadcast';
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: payloadArr, delayMin, delayMax })
                });

                if (!res.ok) throw new Error('Falha na API: ' + await res.text());

                showToast(`Sucesso! ${validNumbersArray.length} contatos postados na fila de disparo.`, 'success');
                if(quickSendNumbers) quickSendNumbers.value = '';
                if(validNumbersList) validNumbersList.innerHTML = '';
                if(invalidNumbersList) invalidNumbersList.innerHTML = '';
                if(countValidNumbers) countValidNumbers.innerText = '0';
                if(countInvalidNumbers) countInvalidNumbers.innerText = '0';
                validNumbersArray = [];

            } catch(e) {
                console.error(e);
                showToast(`Erro ao disparar: ${e.message}`, 'error');
            } finally {
                startQuickSendBtn.disabled = false;
                startQuickSendBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar para Válidos';
            }
        });
    }

    // --- BROADCAST LOGIC ---
    if (startBroadcastBtn) {
        startBroadcastBtn.addEventListener('click', async () => {
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

            if (!confirm(`Sério que deseja enviar as mensagens para ${targetLeads.length} leads? Elas serão agendadas em segundo plano e você não precisa deixar a aba aberta.`)) return;

            // Start UI
            if(startBroadcastBtn) {
                startBroadcastBtn.disabled = true;
                startBroadcastBtn.innerText = 'Preparando pacote...';
            }
            if(broadcastProgressArea) broadcastProgressArea.style.display = 'none';

            // Montar array de mensagens
            const payloadArr = [];
            targetLeads.forEach(lead => {
                const leadName = lead.nome || lead.name || lead.pushName || 'Amigo(a)';
                const leadPhone = lead.telefone || lead.phone || lead.whatsapp || '';

                if (leadPhone) {
                    const cleanPhone = leadPhone.replace(/\D/g, '');
                    const personalizedMessage = rawMessage.replace(/\{\{nome\}\}/gi, leadName.split(' ')[0]);
                    payloadArr.push({ phone: cleanPhone, message: personalizedMessage });
                }
            });

            if (payloadArr.length === 0) {
                showToast('Nenhum número extraído para os leads selecionados.', 'error');
                if(startBroadcastBtn) {
                    startBroadcastBtn.disabled = false;
                    startBroadcastBtn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Disparo';
                }
                return;
            }

            const delayInput = document.getElementById('broadcastDelay') ? document.getElementById('broadcastDelay').value : '15-30';
            const [delayMin, delayMax] = delayInput.split('-').map(Number);

            try {
                // Call API Em Lote
                const apiUrl = window.location.protocol === 'file:' ? 'http://localhost:3000/api/broadcast' : '/api/broadcast';

                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ messages: payloadArr, delayMin, delayMax })
                });

                if (!res.ok) {
                    const errText = await res.text();
                    throw new Error(errText);
                }

                showToast(`Sucesso! Lote de ${payloadArr.length} mensagens inserido na Fila UAZAPI. Agora elas dispararão gradualmente em segundo plano. Podes fechar a aba!`, 'success');
                
            } catch (err) {
                console.error("Lote falhou:", err);
                showToast(`Erro na API Uazapi: ${err.message}`, 'error');
            } finally {
                if(startBroadcastBtn) {
                    startBroadcastBtn.disabled = false;
                    startBroadcastBtn.innerHTML = '<i class="fa-solid fa-check"></i> Disparo Agendado';
                    setTimeout(() => {
                        startBroadcastBtn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar Novo Disparo';
                    }, 5000);
                }
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
