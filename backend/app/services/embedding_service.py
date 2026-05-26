from typing import List
from tenacity import retry, stop_after_attempt, wait_exponential
from app.integrations.openai_client import OpenAIClient

class EmbeddingService:
    """Serviço para geração de embeddings utilizando o cliente da OpenAI.

    Inclui suporte a processamento em lote (batching) e lógica de retentativa
    robusta via tenacity em caso de falhas temporárias na API.
    """

    def __init__(self, client: OpenAIClient, batch_size: int = 100) -> None:
        self.client = client
        self.batch_size = batch_size

    @retry(
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True
    )
    def _embed_batch_with_retry(self, texts: List[str]) -> List[List[float]]:
        """Invoca o cliente para gerar os embeddings de um batch com retentativas."""
        return self.client.embed(texts)

    def get_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Divide a lista de textos em batches e gera os embeddings.

        Retorna a lista de vetores correspondentes a cada texto de entrada.
        """
        if not texts:
            return []

        all_embeddings: List[List[float]] = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            batch_embeddings = self._embed_batch_with_retry(batch)
            all_embeddings.extend(batch_embeddings)

        return all_embeddings
