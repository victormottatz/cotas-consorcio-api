# Estágio 1: Construção (builder)
FROM python:3.9-slim as builder

WORKDIR /app
COPY requirements.txt .

# Instala dependências em um diretório isolado
RUN pip install --user --no-cache-dir -r requirements.txt

# ---

# Estágio 2: Imagem final (otimizada)
FROM python:3.9-slim

WORKDIR /app

# Copia apenas o necessário do estágio builder
COPY --from=builder /root/.local /root/.local
COPY app.py .

# Configurações essenciais
ENV PATH=/root/.local/bin:$PATH \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app

# Porta obrigatória para Hugging Face Spaces
EXPOSE 7860

# Comando otimizado para produção
CMD ["gunicorn", "--bind", "0.0.0.0:7860", "--timeout", "300", "--workers", "2", "app:app"]