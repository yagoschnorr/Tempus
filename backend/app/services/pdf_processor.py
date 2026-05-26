import os
import pdfplumber
from datetime import datetime, timezone
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.document import Document, DocumentChunk, DocumentStatus
from app.services.text_splitter import TiktokenTextSplitter
from app.services.embedding_service import EmbeddingService
from app.integrations.openai_client import OpenAIClient

def process_pdf(
    db: Session,
    document_id: UUID,
    openai_client: OpenAIClient,
    chunk_size: int = 500,
    chunk_overlap: int = 50
) -> None:
    """Executa o pipeline completo de processamento de um documento PDF.

    1. Extração de texto página por página (via pdfplumber).
    2. Divisão do texto em chunks (via TiktokenTextSplitter).
    3. Geração de embeddings para cada chunk (via EmbeddingService).
    4. Persistência dos chunks e atualização do status do documento.
    """
    # 1. Carrega o documento
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        return

    # Atualiza status para processing
    doc.status = DocumentStatus.processing
    db.commit()

    try:
        if not os.path.exists(doc.file_path):
            raise FileNotFoundError(f"Arquivo não encontrado no caminho: {doc.file_path}")

        splitter = TiktokenTextSplitter(chunk_size=chunk_size, chunk_overlap=chunk_overlap)
        chunks_data = []
        total_pages = 0

        # 2. Abre o PDF e extrai texto
        with pdfplumber.open(doc.file_path) as pdf:
            total_pages = len(pdf.pages)
            chunk_idx = 0
            for page_idx, page in enumerate(pdf.pages):
                page_num = page_idx + 1
                text = page.extract_text()
                if not text or not text.strip():
                    continue

                # Divide o texto da página em chunks
                page_chunks = splitter.split_text(text)
                for content in page_chunks:
                    token_count = splitter.count_tokens(content)
                    chunks_data.append({
                        "chunk_index": chunk_idx,
                        "content": content,
                        "page_number": page_num,
                        "token_count": token_count
                    })
                    chunk_idx += 1

        if not chunks_data:
            raise ValueError("Nenhum texto pôde ser extraído do documento PDF.")

        # 3. Gera embeddings
        embed_service = EmbeddingService(openai_client)
        texts_to_embed = [c["content"] for c in chunks_data]
        embeddings = embed_service.get_embeddings(texts_to_embed)

        if len(embeddings) != len(chunks_data):
            raise RuntimeError("A contagem de embeddings gerados diverge da contagem de chunks.")

        # 4. Salva no banco de dados os chunks gerados
        for c_data, embedding in zip(chunks_data, embeddings):
            db_chunk = DocumentChunk(
                document_id=doc.id,
                chunk_index=c_data["chunk_index"],
                content=c_data["content"],
                embedding=embedding,
                page_number=c_data["page_number"],
                token_count=c_data["token_count"]
            )
            db.add(db_chunk)

        # Atualiza status para ready
        doc.status = DocumentStatus.ready
        doc.total_pages = total_pages
        doc.total_chunks = len(chunks_data)
        doc.processed_at = datetime.now(timezone.utc)
        doc.error_message = None
        db.commit()

    except Exception as e:
        db.rollback()
        # Marca como failed e registra erro
        doc.status = DocumentStatus.failed
        doc.error_message = str(e)
        doc.processed_at = datetime.now(timezone.utc)
        db.commit()
