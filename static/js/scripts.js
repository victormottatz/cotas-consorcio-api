document.addEventListener('DOMContentLoaded', function() {
    // Configurações
    const API_BASE_URL = window.location.origin;
    const WHATSAPP_NUMBER = '5516997311100';
    
    // Elementos do DOM
    const filterForm = document.getElementById('filter-form');
    const cotasTableBody = document.getElementById('cotas-table-body');
    const btnSomar = document.getElementById('btn-somar');
    const btnCompartilhar = document.getElementById('btn-compartilhar');
    const limparFiltrosBtn = document.getElementById('limpar-filtros');
    
    // Estado
    let cotasSelecionadas = [];
    
    // Funções auxiliares
    function formatCurrency(value) {
        return parseFloat(value || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }
    
    function formatPercentage(value) {
        return parseFloat(value || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + '%';
    }
    
    function showError(message) {
        cotasTableBody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center text-danger py-4">
                    <i class="bi bi-exclamation-triangle-fill"></i> ${message}
                </td>
            </tr>
        `;
        Swal.fire({
            icon: 'error',
            title: 'Erro',
            text: message,
            confirmButtonColor: '#3085d6'
        });
    }
    
    // Carregar cotas ao iniciar
    carregarCotas();
    
    // Event Listeners
    filterForm.addEventListener('submit', function(e) {
        e.preventDefault();
        carregarCotas();
    });
    
    limparFiltrosBtn.addEventListener('click', function() {
        filterForm.reset();
        carregarCotas();
    });

    // Adiciona os listeners para os botões de somar e compartilhar
    btnSomar.addEventListener('click', function() {
        somarCotasSelecionadas();
    });

    btnCompartilhar.addEventListener('click', function() {
        compartilharCotas();
    });
    
    // Função principal para carregar cotas
    async function carregarCotas() {
        try {
            // Mostrar loading
            cotasTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-4">
                        <div class="spinner-border text-primary" role="status">
                            <span class="visually-hidden">Carregando...</span>
                        </div>
                        <p class="mt-2">Buscando cotas...</p>
                    </td>
                </tr>
            `;
            
            // Preparar dados do formulário
            const formData = new FormData(filterForm);
            const filters = {};
            
            // Ajuste: envia os nomes esperados pelo backend
            for (const [key, value] of formData.entries()) {
                if (value) {
                    if (key === 'credito') filters['valor_credito'] = value;
                    else if (key === 'entrada') filters['valor_entrada'] = value;
                    else if (key === 'parcela') filters['valor_parcela'] = value;
                    else filters[key] = value;
                }
            }
            
            // Fazer requisição
            const response = await fetch(`${API_BASE_URL}/api/cotas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filters)
            });
            
            // Verificar resposta
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro na requisição: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Renderizar tabela
            renderizarTabela(data);
            
        } catch (error) {
            showError(error.message);
        }
    }
    
    // Função para renderizar a tabela
    function renderizarTabela(cotas) {
        cotasTableBody.innerHTML = '';
        cotasSelecionadas = [];
        
        if (!Array.isArray(cotas)) {
            throw new Error('Formato de dados inválido');
        }
        
        if (cotas.length === 0) {
            cotasTableBody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center py-4">Nenhuma cota encontrada</td>
                </tr>
            `;
            return;
        }
        
        cotas.forEach(cota => {
            const row = document.createElement('tr');
            row.dataset.id = cota.id;
            
            // Determinar categoria e disponibilidade
            const categoria = cota.categoria === 'veiculo' ? 'Auto' : 'Imóvel';
            const disponivel = cota.reserva !== 'reservado';
            const comissao = (parseFloat(cota.valor_credito) * 0.085) + parseFloat(cota.entrada);
            
            row.innerHTML = `
                <td class="select-area">
                    <input type="checkbox" class="cota-select" id="cota-${cota.id}">
                    <label for="cota-${cota.id}"><i class="bi bi-check-lg"></i></label>
                </td>
                <td class="icon-cat">${categoria}</td>
                <td>${cota.codigo || 'N/A'}</td>
                <td>${formatCurrency(cota.valor_credito)}</td>
                <td>${formatCurrency(comissao)}</td>
                <td>${cota.parcelas}x ${formatCurrency(cota.valor_parcela)}</td>
                <td class="adm-logo">${cota.admin || 'N/A'}</td>
                <td class="view-cota">
                    <span class="ver-cota" data-id="${cota.id}">
                        <i class="bi bi-eye"></i>
                    </span>
                </td>
                <td>
                    ${disponivel ? `
                        <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Interesse na cota ${cota.codigo} - ${categoria} - Crédito: ${formatCurrency(cota.valor_credito)}" 
                           class="btn-reserva btn-reservar" target="_blank">
                            <i class="bi bi-whatsapp"></i> Negociar
                        </a>
                    ` : `
                        <span class="btn-reserva btn-reservado">Reservado</span>
                    `}
                </td>
            `;
            
            cotasTableBody.appendChild(row);
        });
        
        // Adicionar eventos após renderização
        adicionarEventosTabela();
        atualizarBotoes();
    }
    
    function adicionarEventosTabela() {
        // Eventos para seleção de cotas
        document.querySelectorAll('.cota-select').forEach(checkbox => {
            checkbox.addEventListener('change', function() {
                const row = this.closest('tr');
                const cotaId = row.dataset.id;
                
                if (this.checked) {
                    row.classList.add('selected');
                    if (!cotasSelecionadas.includes(cotaId)) {
                        cotasSelecionadas.push(cotaId);
                    }
                } else {
                    row.classList.remove('selected');
                    cotasSelecionadas = cotasSelecionadas.filter(id => id !== cotaId);
                }
                
                atualizarBotoes();
            });
        });
        
        // Eventos para visualização de detalhes
        document.querySelectorAll('.ver-cota').forEach(btn => {
            btn.addEventListener('click', function() {
                const cotaId = this.dataset.id;
                mostrarDetalhesCota(cotaId);
            });
        });
    }
    
    function atualizarBotoes() {
        btnSomar.disabled = cotasSelecionadas.length === 0;
        btnCompartilhar.disabled = cotasSelecionadas.length === 0;
    }
    
    async function mostrarDetalhesCota(cotaId) {
        try {
            const response = await fetch(`${API_BASE_URL}/api/detalhes_cota/${cotaId}`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro na requisição: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            const cota = data.cota;
            const categoria = cota.categoria === 'veiculo' ? 'Auto' : 'Imóvel';
            const reserva = cota.reserva === 'reservado' ? 'Reservado' : 'Disponível';
            
            const modalBody = document.getElementById('detalhes-cota-body');
            modalBody.innerHTML = `
                <div class="body-modal">
                    <p><strong>Administradora:</strong> ${cota.admin || 'Não informado'}</p>
                    <p><strong>Código:</strong> ${cota.codigo}</p>
                    <p><strong>Nome:</strong> ${categoria}</p>
                    <p><strong>Crédito:</strong> ${formatCurrency(cota.valor_credito)}</p>
                    <p><strong>Entrada:</strong> ${formatCurrency(data.comissao)} (${formatPercentage(data.entradaporcem)})</p>
                    <p><strong>Prazo:</strong> ${cota.parcelas}x</p>
                    <p><strong>Parcelas:</strong> ${formatCurrency(cota.valor_parcela)}</p>
                    <p><strong>Data Próx. Parcela:</strong> ${data.data_prox_parcela}</p>
                    <p><strong>Saldo Devedor:</strong> ${formatCurrency(cota.saldo)}</p>
                    ${categoria === 'Imóvel' ? `
                        <p><strong>Fundo Comum:</strong> À consultar</p>
                        <p><strong>Avaliação do Imóvel:</strong> À consultar</p>
                    ` : ''}
                    <p><strong>Transferência:</strong> À consultar</p>
                    <p><strong>Seguro de Vida:</strong> À consultar</p>
                    <br>
                    <p><strong>Situação:</strong> ${reserva}</p>
                    <br>
                    <p><strong>-- Condições de contratação --</strong><p>
                    <p><small>Crédito Real: ${formatCurrency(data.credito_real)}</small></p>
                    <p><small>Valor Final: ${formatCurrency(data.valor_final)}</small></p>
                    <p><small>Valor da Taxa: ${formatCurrency(data.taxa)}</small></p>
                    <p><small>Porcentagem da Taxa: ${formatPercentage(data.taxaporcem)}</small></p>
                    <p><small>Juros ao Mês: ${formatPercentage(data.JMensal)}</small></p>
                    <p><small>Juros ao Ano: ${formatPercentage(data.JAnual)}</small></p>
                </div>
                <div class="footer-modal">
                    <div class="d-flex align-items-center justify-content-between">
                        <a href="https://api.whatsapp.com/send?text=Lista%20de%20Cartas%20Contempladas%3A%0ACR%C3%89DITO%3A%20${formatCurrency(cota.valor_credito)}%0AENTRADA%3A%20${formatCurrency(cota.entrada)}%0APARCELAS%3A%20${cota.parcelas}x%20${formatCurrency(cota.valor_parcela)}%0A${cota.admin || 'Não informado'}%0ATAXA%20DE%20TRANSFER%C3%8ANCIA%3A%20À%20consultar%0ASEGURO%20DE%20VIDA%3A%20À%20consultar" 
                           target="_blank" class="compartilhar-cota d-flex align-items-center" type="button">
                            <i class="bi bi-share-fill"></i> Compartilhar
                        </a>
                        ${reserva === 'Disponível' ? `
                            <a href="https://wa.me/${WHATSAPP_NUMBER}?text=Interesse na cota ${cota.codigo} - ${categoria} - Crédito: ${formatCurrency(cota.valor_credito)}" 
                               target="_blank" class="negociar-cota d-flex align-items-center" type="button">
                                <i class="bi bi-whatsapp"></i> Negociar
                            </a>
                        ` : ''}
                    </div>
                </div>
            `;
            
            // Abrir modal
            const detalhesModal = new bootstrap.Modal(document.getElementById('detalhesModal'));
            detalhesModal.show();
            
        } catch (error) {
            showError('Erro ao carregar detalhes da cota');
        }
    }
    
    async function somarCotasSelecionadas() {
        if (cotasSelecionadas.length === 0) return;
        
        try {
            const response = await fetch(`${API_BASE_URL}/api/somar_cotas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ cotas_ids: cotasSelecionadas })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro na requisição: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Preencher modal de soma
            const modalBody = document.getElementById('somar-cotas-body');
            modalBody.innerHTML = `
                <div class="soma-container">
                    <div class="soma-header">
                        <h5>Resumo da Soma das Cotas</h5>
                        <p class="text-muted">${data.categoria} - ${data.admin}</p>
                    </div>
                    
                    <div class="soma-valores">
                        <div class="soma-item">
                            <span>Crédito Total:</span>
                            <strong>${formatCurrency(data.total_credito)}</strong>
                        </div>
                        <div class="soma-item">
                            <span>Entrada Total:</span>
                            <strong>${formatCurrency(data.total_comissao)} (${formatPercentage(data.total_entradaporcem)})</strong>
                        </div>
                        <div class="soma-item">
                            <span>Parcelas Totais:</span>
                            <strong>${data.total_parcelas}x</strong>
                        </div>
                        <div class="soma-item">
                            <span>Valor Médio da Parcela:</span>
                            <strong>${formatCurrency(data.media_valor_parcela)}</strong>
                        </div>
                        <div class="soma-item">
                            <span>Saldo Devedor Total:</span>
                            <strong>${formatCurrency(data.total_saldo)}</strong>
                        </div>
                        <div class="soma-item">
                            <span>Dia do Vencimento:</span>
                            <strong>${data.menor_vencimento}</strong>
                        </div>
                    </div>
                    
                    <div class="soma-detalhes">
                        <p class="open-cartas d-flex align-items-center justify-content-between">
                            Condições de Contratação <i class="bi bi-chevron-down"></i>
                        </p>
                        <div class="detalhes-cotas" style="display:none;">
                            <div class="detalhe-cota">
                                <div class="d-flex align-items-center justify-content-between tp2">
                                    <small>Crédito Real: ${formatCurrency(data.credito_real)}</small>
                                </div>
                                <div class="d-flex align-items-center justify-content-between tp2">
                                    <small>Valor Final: ${formatCurrency(data.valor_final)}</small>
                                </div>
                                <div class="d-flex align-items-center justify-content-between tp2">
                                    <small>Valor da Taxa: ${formatCurrency(data.taxa)}</small>
                                </div>
                                <div class="d-flex align-items-center justify-content-between tp2">
                                    <small>Porcentagem da Taxa: ${formatPercentage(data.taxaporcem)}</small>
                                </div>
                                <div class="d-flex align-items-center justify-content-between tp2">
                                    <small>Juros ao mês: ${formatPercentage(data.JMensal)}</small>
                                </div>
                                <div class="d-flex align-items-center justify-content-between tp2">
                                    <small>Juros ao ano: ${formatPercentage(data.JAnual)}</small>
                                </div>
                            </div>
                        </div>
                        
                        <p class="open-cartas d-flex align-items-center justify-content-between mt-3">
                            Cartas Selecionadas (${data.detalhes.length}) <i class="bi bi-chevron-down"></i>
                        </p>
                        <div class="detalhes-cotas" style="display:none;">
                            ${data.detalhes.map(detalhe => `
                                <div class="detalhe-cota mb-2">
                                    <div class="d-flex align-items-center justify-content-between tp1">
                                        <small>#${detalhe.codigo}</small>
                                        <span>${formatCurrency(detalhe.credito)}</span>
                                    </div>
                                    <div class="d-flex align-items-center justify-content-between tp2">
                                        <small><strong>${detalhe.categoria}</strong></small>
                                        <small>${detalhe.parcelas}X de ${formatCurrency(detalhe.valor_parcela)}</small>
                                    </div>
                                    <div class="d-flex align-items-center justify-content-between tp2">
                                        <small>Entrada: ${formatCurrency(detalhe.entrada)}</small>
                                        <small>Saldo: ${formatCurrency(detalhe.saldo)}</small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="soma-actions mt-3">
                        <button class="btn btn-primary" onclick="navigator.clipboard.writeText('${data.link_share}'); Swal.fire('Sucesso', 'Texto copiado para a área de transferência!', 'success')">
                            <i class="bi bi-clipboard"></i> Copiar Resumo
                        </button>
                    </div>
                </div>
            `;
            
            // Abrir modal
            const somarModal = new bootstrap.Modal(document.getElementById('somarModal'));
            somarModal.show();
            
            // Eventos para abrir/fechar seções
            document.querySelectorAll('.open-cartas').forEach(item => {
                item.addEventListener('click', function() {
                    const detalhes = this.nextElementSibling;
                    const icon = this.querySelector('i');
                    
                    if (detalhes.style.display === 'none') {
                        detalhes.style.display = 'block';
                        icon.classList.remove('bi-chevron-down');
                        icon.classList.add('bi-chevron-up');
                    } else {
                        detalhes.style.display = 'none';
                        icon.classList.remove('bi-chevron-up');
                        icon.classList.add('bi-chevron-down');
                    }
                });
            });
            
        } catch (error) {
            showError('Erro ao somar as cotas selecionadas');
        }
    }
    
    function compartilharCotas() {
        if (cotasSelecionadas.length === 0) return;
        
        // Montar link do WhatsApp
        let texto = "Lista de Cartas Contempladas:\n";
        
        // Obter detalhes das cotas selecionadas
        cotasSelecionadas.forEach(id => {
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) {
                const codigo = row.querySelector('td:nth-child(3)').textContent;
                const categoria = row.querySelector('td:nth-child(2)').textContent;
                const credito = row.querySelector('td:nth-child(4)').textContent;
                
                texto += `\n${categoria} - Código: ${codigo} - Crédito: ${credito}`;
            }
        });
        
        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
        window.open(whatsappUrl, '_blank');
    }
});