from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
import os
from dotenv import load_dotenv
from datetime import datetime
import logging
from cachetools import TTLCache
from flask_compress import Compress 
from concurrent.futures import ThreadPoolExecutor
from dateutil.relativedelta import relativedelta

# Configuração de logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

load_dotenv()

app = Flask(__name__)
Compress(app)  # Ativa compressão Gzip
cache = TTLCache(maxsize=100, ttl=300)  # Cache com expiração de 5 minutos
executor = ThreadPoolExecutor(2)  # Pool de threads para operações I/O

# Configuração do Supabase
try:
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_KEY')
    
    if not SUPABASE_URL or not SUPABASE_KEY:
        raise ValueError("Variáveis de ambiente SUPABASE_URL e SUPABASE_KEY não configuradas")
    
    logger.info(f"Conectando ao Supabase em: {SUPABASE_URL}")
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    supabase.table('cotas').select('*').limit(1).execute()  # Teste de conexão
except Exception as e:
    logger.critical(f"Erro ao conectar com Supabase: {str(e)}")
    supabase = None

# ==================== ROTAS ====================

@app.route('/health')
def health_check():
    """Endpoint para monitoramento de saúde"""
    try:
        db_ok = bool(supabase and supabase.table('cotas').select('*').limit(1).execute())
        return jsonify({
            "status": "healthy" if db_ok else "degraded",
            "supabase_connected": db_ok,
            "timestamp": datetime.now().isoformat(),
            "cache_size": len(cache)
        }), 200 if db_ok else 500
    except Exception as e:
        return jsonify({"status": "down", "error": str(e)}), 500

@app.route('/')
def index():
    """Página principal com template pré-renderizado"""
    cotas = cache.get('cotas_destaque') or []
    if not cotas:
        try:
            cotas = supabase.table('cotas').select('*').limit(4).execute().data
            cache['cotas_destaque'] = cotas
        except Exception as e:
            logger.error(f"Erro ao carregar destaques: {str(e)}")
    
    return render_template('index.html', cotas=cotas)

@app.route('/api/cotas', methods=['POST'])
def filter_cotas():
    """API para filtrar cotas com cache"""
    if not supabase:
        return jsonify({'error': 'Conexão com o banco não estabelecida'}), 500
    
    try:
        if not request.is_json:
            return jsonify({'error': 'Content-Type deve ser application/json'}), 400
        
        filters = request.get_json() or {}
        cache_key = f"cotas_{hash(frozenset(filters.items()))}"
        
        if cache_key in cache:
            return jsonify(cache[cache_key])
        
        query = supabase.table('cotas').select('*, administradoras(nome)')
        
        # Aplica filtros
        if filters.get('tipo_bem') and filters['tipo_bem'] != 'todos':
            query = query.eq('categoria', filters['tipo_bem'])
        if filters.get('valor_credito'):
            query = query.gte('valor_credito', str(filters['valor_credito']))
        
        cotas = query.execute().data
        cache[cache_key] = cotas
        
        return jsonify(cotas)
        
    except Exception as e:
        logger.error(f"Erro em /api/cotas: {str(e)}", exc_info=True)
        return jsonify({'error': 'Erro interno'}), 500

@app.route('/api/detalhes_cota/<int:cota_id>')
def detalhes_cota(cota_id):
    """Endpoint com cálculos financeiros usando thread separada"""
    if not supabase or not isinstance(cota_id, int) or cota_id <= 0:
        return jsonify({'error': 'Parâmetros inválidos'}), 400
    
    try:
        def _fetch_cota():
            response = supabase.table('cotas').select('*, administradoras(nome)').eq('id', cota_id).execute()
            if not response.data:
                return None
            return response.data[0]
        
        cota = executor.submit(_fetch_cota).result()
        if not cota:
            return jsonify({'error': 'Cota não encontrada'}), 404
        
        # Cálculos financeiros
        credito = float(cota.get('valor_credito', 0))
        entrada = float(cota.get('entrada', 0))
        saldo = float(cota.get('saldo', 0))
        parcelas = int(cota.get('parcelas', 1))
        
        # Comissão (8.5% do crédito + entrada)
        comissao = (credito * 0.085) + entrada
        
        # Próxima parcela (com dateutil para precisão)
        dia_vencimento = int(cota.get('vencimento', 1))
        proxima_data = datetime.now() + relativedelta(months=1, day=dia_vencimento)
        
        # Cálculos conforme solicitado
        valor_final = saldo + entrada
        valor_taxa = valor_final - credito
        porcentagem_taxa = (valor_taxa / credito) * 100 if credito != 0 else 0
        juros_mes = porcentagem_taxa / 100 * parcelas
        juros_ano = porcentagem_taxa / 100 * 12
        
        return jsonify({
            'cota': cota,
            'data_prox_parcela': proxima_data.strftime("%d/%m/%Y"),
            'credito_real': credito - comissao,
            'comissao': comissao,
            'entradaporcem': (comissao / credito) * 100 if credito else 0,
            'valor_final': valor_final,
            'valor_taxa': valor_taxa,
            'porcentagem_taxa': porcentagem_taxa,
            'juros_mes': juros_mes,
            'juros_ano': juros_ano
        })
        
    except Exception as e:
        logger.error(f"Erro em detalhes_cota: {str(e)}")
        return jsonify({'error': 'Erro interno'}), 500
    
@app.route('/api/somar_cotas', methods=['POST'])
def somar_cotas():
    if not supabase:
        print("Supabase não conectado")
        return jsonify({'error': 'Conexão com o banco de dados não estabelecida'}), 500
    
    try:
        cotas_ids = request.json.get('cotas_ids', [])
        print("IDs recebidos:", cotas_ids)

        if not cotas_ids:
            return jsonify({'error': 'Nenhum ID de cota fornecido'}), 400
        
        response = supabase.table('cotas').select('*').in_('id', cotas_ids).execute()
        cotas = response.data

        if not cotas:
            return jsonify({'error': 'Nenhuma cota encontrada'}), 404
        
        for c in cotas:
            for campo in ['valor_credito', 'entrada', 'saldo', 'parcelas', 'valor_parcela', 'administradora_id', 'categoria', 'vencimento', 'codigo']:
                if campo not in c or c[campo] is None:
                    print(f"Campo ausente ou nulo: {campo} na cota {c.get('id')}")
                    return jsonify({'error': f"Campo ausente ou nulo: {campo} na cota {c.get('id')}" }), 400
        
        primeira_admin = cotas[0]['administradora_id']
        primeira_categoria = cotas[0]['categoria']

        mesma_admin = all(c.get('administradora_id') == primeira_admin for c in cotas)
        mesma_categoria = all(c.get('categoria') == primeira_categoria for c in cotas)

        if not mesma_admin or not mesma_categoria:
            return jsonify({'error': 'As cotas selecionadas têm administradoras ou categorias diferentes'}), 400
        
        admin_response = supabase.table('administradoras').select('nome').eq('id', primeira_admin).execute()
        nome_admin = admin_response.data[0]['nome'] if admin_response.data else 'Desconhecida'

        total_credito = sum(float(c['valor_credito']) for c in cotas)
        total_entrada = sum(float(c['entrada']) for c in cotas)
        total_saldo = sum(float(c['saldo']) for c in cotas)
        total_parcelas = max(int(c['parcelas']) for c in cotas)  # Maior valor de parcela
        total_valor_parcela = sum(float(c['valor_parcela']) for c in cotas)
        media_parcelas = total_parcelas  # Agora é igual ao total (não precisa de média)
        media_valor_parcela = total_valor_parcela / len(cotas)
        total_comissao = total_entrada
        total_entradaporcem = (total_comissao / total_credito) * 100 if total_credito != 0 else 0
        credito_real = total_credito - total_comissao
        valor_final = total_saldo + total_comissao
        taxa = total_saldo - credito_real
        taxaporcem = (taxa / credito_real) * 100 if credito_real != 0 else 0
        JMensal = taxaporcem / media_parcelas if media_parcelas != 0 else 0
        JAnual = JMensal * 12
        menor_vencimento = min(int(c['vencimento']) for c in cotas)

        detalhes = [{
            'codigo': c['codigo'],
            'credito': float(c['valor_credito']),
            'categoria': 'Imóvel' if c['categoria'] == 'imovel' else 'Auto',
            'parcelas': int(c['parcelas']),
            'valor_parcela': float(c['valor_parcela']),
            'saldo': float(c['saldo']),
            'entrada': float(c['entrada'])
        } for c in cotas]

        link_share = f"ADMINISTRADORA: {nome_admin}\n"
        link_share += f"CRÉDITO TOTAL: R$ {total_credito:,.2f}\n"
        link_share += f"ENTRADA TOTAL: R$ {total_comissao:,.2f} ({total_entradaporcem:.2f}%)\n"
        link_share += f"PARCELAS TOTAIS: {total_parcelas}x\n"
        link_share += f"VALOR MÉDIO DA PARCELA: R$ {media_valor_parcela:,.2f}\n"
        link_share += f"SALDO DEVEDOR TOTAL: R$ {total_saldo:,.2f}\n"
        link_share += f"DIA DO VENCIMENTO: {menor_vencimento}\n"

        if primeira_categoria == 'imovel':
            link_share += "FUNDO COMUM: À Consultar\n"
            link_share += "AVALIAÇÃO DO IMÓVEL: À Consultar\n"

        link_share += "CARTAS SELECIONADAS:\n"
        for item in detalhes:
            link_share += f"N°: {item['codigo']} {item['categoria']} R$ {item['credito']:,.2f}\n"

        return jsonify({
            'admin': nome_admin,
            'categoria': 'Imóvel' if primeira_categoria == 'imovel' else 'Auto',
            'total_credito': total_credito,
            'total_entrada': total_entrada,
            'total_comissao': total_comissao,
            'total_entradaporcem': total_entradaporcem,
            'total_saldo': total_saldo,
            'total_parcelas': total_parcelas,
            'media_parcelas': media_parcelas,
            'media_valor_parcela': media_valor_parcela,
            'menor_vencimento': menor_vencimento,
            'credito_real': credito_real,
            'valor_final': valor_final,
            'taxa': taxa,
            'taxaporcem': taxaporcem,
            'JMensal': JMensal,
            'JAnual': JAnual,
            'detalhes': detalhes,
            'link_share': link_share,
            'disponivel': all(c['reserva'] != 'reservado' for c in cotas)
        })
        
    except Exception as e:
        logger.error(f"Erro ao somar cotas: {str(e)}")
        return jsonify({'error': 'Erro interno ao processar a requisição'}), 500

@app.route('/api/iniciar_negociacao', methods=['POST'])
def iniciar_negociacao():
    if not supabase:
        return jsonify({'error': 'Conexão com o banco de dados não estabelecida'}), 500
    
    try:
        data = request.get_json()
        cotas_ids = data.get('cotas_ids', [])
        tipo_contato = data.get('tipo_contato', 'negociar')
        
        if not cotas_ids:
            return jsonify({'error': 'Nenhum ID de cota fornecido'}), 400
        
        response = supabase.table('cotas').select('*').in_('id', cotas_ids).execute()
        cotas = response.data
        
        if not cotas:
            return jsonify({'error': 'Nenhuma cota encontrada'}), 404
        
        primeira_admin = cotas[0]['administradora_id']
        mesma_admin = all(c.get('administradora_id') == primeira_admin for c in cotas)
        
        if not mesma_admin:
            return jsonify({'error': 'As cotas selecionadas têm administradoras diferentes'}), 400
        
        admin_response = supabase.table('administradoras').select('nome').eq('id', primeira_admin).execute()
        nome_admin = admin_response.data[0]['nome'] if admin_response.data else 'Desconhecida'
        
        resumo = {
            'tipo_contato': tipo_contato,
            'admin': nome_admin,
            'quantidade_cotas': len(cotas),
            'cotas': [{
                'codigo': c['codigo'],
                'categoria': 'Imóvel' if c['categoria'] == 'imovel' else 'Auto',
                'credito': float(c['valor_credito']),
                'entrada': float(c['entrada']),
                'parcelas': int(c['parcelas']),
                'valor_parcela': float(c['valor_parcela'])
            } for c in cotas],
            'total_credito': sum(float(c['valor_credito']) for c in cotas),
            'total_entrada': sum(float(c['entrada']) for c in cotas),
            'disponivel': all(c['reserva'] != 'reservado' for c in cotas)
        }
        
        return jsonify(resumo)
        
    except Exception as e:
        logger.error(f"Erro ao iniciar negociação: {str(e)}")
        return jsonify({'error': 'Erro interno ao processar a requisição'}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

