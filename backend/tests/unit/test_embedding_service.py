import pytest
from unittest.mock import MagicMock
from app.services.embedding_service import EmbeddingService
from app.integrations.openai_client import FakeDemoClient

def test_get_embeddings_empty():
    client = FakeDemoClient()
    service = EmbeddingService(client)
    assert service.get_embeddings([]) == []

def test_get_embeddings_batching():
    client = FakeDemoClient()
    # Usando batch_size=2 com 5 elementos -> deve fazer 3 chamadas
    mock_embed = MagicMock(side_effect=client.embed)
    client.embed = mock_embed

    service = EmbeddingService(client, batch_size=2)
    texts = ["t1", "t2", "t3", "t4", "t5"]
    embeddings = service.get_embeddings(texts)

    assert len(embeddings) == 5
    assert mock_embed.call_count == 3
    # Verifica os argumentos de cada chamada
    mock_embed.assert_any_call(["t1", "t2"])
    mock_embed.assert_any_call(["t3", "t4"])
    mock_embed.assert_any_call(["t5"])

def test_get_embeddings_retry_on_failure():
    mock_client = MagicMock()
    # Simula falha nas primeiras duas tentativas, sucesso na terceira
    mock_client.embed.side_effect = [
        RuntimeError("API Error"),
        RuntimeError("API Error"),
        [[0.1] * 1536]
    ]

    service = EmbeddingService(mock_client, batch_size=1)
    # Reduz o tempo de espera do retry para o teste rodar rápido
    service._embed_batch_with_retry.retry.wait = lambda *args, **kwargs: 0.01

    embeddings = service.get_embeddings(["test"])
    assert len(embeddings) == 1
    assert mock_client.embed.call_count == 3

def test_get_embeddings_exhausts_retries():
    mock_client = MagicMock()
    # Simula falha persistente
    mock_client.embed.side_effect = RuntimeError("API Error")

    service = EmbeddingService(mock_client, batch_size=1)
    service._embed_batch_with_retry.retry.wait = lambda *args, **kwargs: 0.01

    with pytest.raises(RuntimeError, match="API Error"):
        service.get_embeddings(["test"])
    
    assert mock_client.embed.call_count == 4  # 1 inicial + 3 retries
