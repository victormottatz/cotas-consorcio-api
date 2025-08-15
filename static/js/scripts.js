document.addEventListener('DOMContentLoaded', function() {
    // Configurações
    const API_BASE_URL = window.location.origin;
    const WHATSAPP_NUMBER = '5511999999999'; // Substitua pelo número de WhatsApp desejado
    
    // Elementos do DOM
    const filterForm = document.getElementById('filter-form');
    const cotasTableBody = document.getElementById('cotas-table-body');
    const btnSomar = document.getElementById('btn-somar');
    const btnCompartilhar = document.getElementById('btn-compartilhar');
    const limparFiltrosBtn = document.getElementById('limpar-filtros');
    // Novos elementos flutuantes
    const btnSomarFlutuante = document.getElementById('btn-somar-flutuante');
    const btnLimparFlutuante = document.getElementById('btn-limpar-flutuante');
    const btnCompartilharFlutuante = document.getElementById('btn-compartilhar-flutuante');
    
    // Estado
    let cotasSelecionadas = [];

    // Função para obter o nome da administradora com fallbacks robustos
    function getAdministradora(cota) {
        // Mapeamento manual dos IDs para nomes
        const adminMap = {
            1: 'Itaú',
            2: 'Bradesco',
            3: 'Santander',
            4: 'Honda',
            5: 'Volkswagen',
            6: 'Serello',
            7: 'Ademicon',
            8: 'Remaza',
            9: 'Porto Seguro VP',
            10: 'Banrisul',
            11: 'Embracon',
            12: 'Serrana Consorcios',
            13: 'Caixa XS5',
            14: 'Caixa CNP',
            15: 'Unifisa',
            16: 'HS Consorcios',
            17: 'Caixa Seguradora',
            18: 'Porto Seguro',
            19: 'Mycon',
            20: 'Rodobens',
            21: 'Ford',
            22: 'Sicoob Unicoob',
            23: 'Zema',
            24: 'Maggi',
            25: 'Ancora',
            26: 'Yamaha',
            27: 'Sponchiado',
            28: 'Scania',
            29: 'Disal Consorcios',
            30: 'Servopa',
            31: 'Canopus',
            32: 'Bradesco',
            33: 'Banco do Brasil',
            34: 'Santander',
            35: 'Sicredi'
        };
        
        // Tenta obter o nome em várias possíveis estruturas
        return cota.administradora?.name || 
               cota.administradora?.nome ||
               adminMap[cota.administradora_id] ||
               cota.admin_name || 
               cota.admin ||
               (cota.administradora_id ? `ID ${cota.administradora_id}` : 'Não especificado');
    }
    
    // Formata valores monetários
    function formatCurrency(value) {
        return parseFloat(value || 0).toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }
    
    // Formata porcentagens
    function formatPercentage(value) {
        return parseFloat(value || 0).toLocaleString('pt-BR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }) + '%';
    }
    
    // Exibe mensagens de erro
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
    
    // Carrega cotas ao iniciar
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

    btnSomar.addEventListener('click', function() {
        somarCotasSelecionadas();
    });

    btnCompartilhar.addEventListener('click', function() {
        compartilharCotas();
    });

    // Event listeners para os botões flutuantes
    if (btnCompartilharFlutuante) {
        btnCompartilharFlutuante.addEventListener('click', function() {
            compartilharCotas();
        });
    }

    if (btnSomarFlutuante) {
        btnSomarFlutuante.addEventListener('click', function() {
            somarCotasSelecionadas();
        });
    }

    if (btnLimparFlutuante) {
        btnLimparFlutuante.addEventListener('click', function() {
            filterForm.reset();
            carregarCotas();
        });
    }

    /*
    // Controla visibilidade dos botões flutuantes
    window.addEventListener('scroll', function() {
        const botoesFlutuantes = document.querySelector('.botoes-flutuantes');
        if (window.scrollY > 300) {
            botoesFlutuantes.classList.add('visible');
        } else {
            botoesFlutuantes.classList.remove('visible');
        }
    });

    // Mostrar imediatamente se já estiver scrolado
    const botoesFlutuantes = document.querySelector('.botoes-flutuantes');
    if (window.scrollY > 300) {
        botoesFlutuantes.classList.add('visible');
    }
    */

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
            
            // Mapear campos do formulário
            for (const [key, value] of formData.entries()) {
                if (value) {
                    if (key === 'credito') filters['valor_credito'] = value;
                    else if (key === 'entrada') filters['valor_entrada'] = value;
                    else if (key === 'parcela') filters['valor_parcela'] = value;
                    else filters[key] = value;
                }
            }
            
            console.log("Enviando filtros:", filters);
            
            // Fazer requisição com join explícito para administradoras
            const response = await fetch(`${API_BASE_URL}/api/cotas?join=administradora`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filters)
            });
            
            console.log("Resposta da API:", response);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro na requisição: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Dados recebidos:", data);
            
            // Verificar estrutura dos dados
            if (data.length > 0) {
                console.log("Exemplo de cota recebida:", {
                    id: data[0].id,
                    campos: Object.keys(data[0]),
                    dados_administradora: data[0].administradora || 'Não encontrado'
                });
            }
            
            // Renderizar tabela
            renderizarTabela(data);
            
        } catch (error) {
            console.error("Erro ao carregar cotas:", error);
            showError(error.message);
        }
    }
    
    // Renderiza a tabela de cotas
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
            
            // Debug: verificar estrutura da cota
            console.log("Processando cota:", {
                id: cota.id,
                codigo: cota.codigo,
                administradora: cota.administradora,
                admin_name: cota.admin_name,
                admin: cota.admin
            });
            
            // Determinar categoria e disponibilidade
            const categoria = cota.categoria === 'veiculo' ? 'Auto' : 'Imóvel';
            const disponivel = cota.reserva !== 'reservado';
            const comissao = (parseFloat(cota.valor_credito) * 0.085) + parseFloat(cota.entrada);
            const adminNome = getAdministradora(cota);
            
            console.log(`Administradora para cota ${cota.codigo}:`, adminNome);
            
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
                <td class="adm-logo">${adminNome}</td>
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
    
    // Adiciona eventos à tabela renderizada
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
    
    // Atualiza estado dos botões
    function atualizarBotoes() {
        btnSomar.disabled = cotasSelecionadas.length === 0;
        btnCompartilhar.disabled = cotasSelecionadas.length === 0;
    }
    
    // Mostra modal com detalhes da cota
    async function mostrarDetalhesCota(cotaId) {
        try {
            console.log(`Buscando detalhes para cota ${cotaId}`);
            const response = await fetch(`${API_BASE_URL}/api/detalhes_cota/${cotaId}?join=administradora`);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Erro na requisição: ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Detalhes recebidos:", data);
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            const cota = data.cota;
            const categoria = cota.categoria === 'veiculo' ? 'Auto' : 'Imóvel';
            const reserva = cota.reserva === 'reservado' ? 'Reservado' : 'Disponível';
            const adminNome = getAdministradora(cota);
            
            console.log(`Administradora no modal: ${adminNome}`);
            
            const modalBody = document.getElementById('detalhes-cota-body');
            modalBody.innerHTML = `
                <div class="body-modal">
                    <p><strong>Administradora:</strong> ${adminNome}</p>
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
                    <p><small>Valor da Taxa: ${formatCurrency(data.valor_taxa)}</small></p>
                    <p><small>Porcentagem da Taxa: ${formatPercentage(data.porcentagem_taxa)}</small></p>
                    <p><small>Juros ao Mês: ${formatPercentage(data.juros_mes)}</small></p>
                    <p><small>Juros ao Ano: ${formatPercentage(data.juros_ano)}</small></p>
                </div>
                <div class="footer-modal">
                    <div class="d-flex align-items-center justify-content-between">
                        <a href="https://api.whatsapp.com/send?text=Lista%20de%20Cartas%20Contempladas%3A%0ACR%C3%89DITO%3A%20${formatCurrency(cota.valor_credito)}%0AENTRADA%3A%20${formatCurrency(cota.entrada)}%0APARCELAS%3A%20${cota.parcelas}x%20${formatCurrency(cota.valor_parcela)}%0A${adminNome}%0ATAXA%20DE%20TRANSFER%C3%8ANCIA%3A%20%C3%80%20consultar%0ASEGURO%20DE%20VIDA%3A%20%C3%80%20consultar" 
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
            console.error("Erro no modal de detalhes:", error);
            showError('Erro ao carregar detalhes da cota');
        }
    }
    
    // Soma as cotas selecionadas
    async function somarCotasSelecionadas() {
        if (cotasSelecionadas.length === 0) return;
        
        try {
            console.log("Somar cotas:", cotasSelecionadas);
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
            console.log("Resultado da soma:", data);
            
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
            console.error("Erro ao somar cotas:", error);
            showError('Erro ao somar as cotas selecionadas');
        }
    }
    
    // Compartilha cotas selecionadas via WhatsApp
    function compartilharCotas() {
        if (cotasSelecionadas.length === 0) return;
        
        console.log("Compartilhando cotas:", cotasSelecionadas);
        
        // Montar link do WhatsApp
        let texto = "Lista de Cartas Contempladas:\n";
        
        // Obter detalhes das cotas selecionadas
        cotasSelecionadas.forEach(id => {
            const row = document.querySelector(`tr[data-id="${id}"]`);
            if (row) {
                const codigo = row.querySelector('td:nth-child(3)').textContent;
                const categoria = row.querySelector('td:nth-child(2)').textContent;
                const credito = row.querySelector('td:nth-child(4)').textContent;
                const admin = row.querySelector('td:nth-child(7)').textContent;
                
                texto += `\n${categoria} - Código: ${codigo} - Crédito: ${credito} - Admin: ${admin}`;
            }
        });
        
        const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(texto)}`;
        console.log("URL do WhatsApp:", whatsappUrl);
        window.open(whatsappUrl, '_blank');
    }
});