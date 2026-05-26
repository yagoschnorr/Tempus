import tiktoken
from typing import List

class TiktokenTextSplitter:
    """Divide texto em chunks medidos por tokens do tiktoken."""

    def __init__(
        self,
        chunk_size: int = 500,
        chunk_overlap: int = 50,
        encoding_name: str = "cl100k_base"
    ) -> None:
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.encoding = tiktoken.get_encoding(encoding_name)

    def count_tokens(self, text: str) -> int:
        """Retorna a contagem exata de tokens de um texto."""
        return len(self.encoding.encode(text))

    def split_text(self, text: str) -> List[str]:
        """Divide um texto longo em chunks com base na contagem de tokens."""
        if not text or not text.strip():
            return []

        tokens = self.encoding.encode(text)
        num_tokens = len(tokens)
        chunks: List[str] = []

        if num_tokens <= self.chunk_size:
            return [text]

        start = 0
        while start < num_tokens:
            end = start + self.chunk_size
            chunk_tokens = tokens[start:end]
            chunks.append(self.encoding.decode(chunk_tokens))
            
            # Se já pegamos até o fim do texto, encerramos
            if end >= num_tokens:
                break
                
            # Avança o cursor considerando o overlap
            start = end - self.chunk_overlap
            
            # Salvaguarda para evitar loops infinitos se overlap >= chunk_size
            if start >= end:
                start = end

        return chunks
