import pytest
from app.services.text_splitter import TiktokenTextSplitter

def test_count_tokens():
    splitter = TiktokenTextSplitter()
    text = "Olá, mundo! Este é um teste do divisor de texto."
    tokens_count = splitter.count_tokens(text)
    assert tokens_count > 0
    assert isinstance(tokens_count, int)

def test_split_empty_text():
    splitter = TiktokenTextSplitter()
    assert splitter.split_text("") == []
    assert splitter.split_text("   ") == []

def test_split_short_text():
    splitter = TiktokenTextSplitter(chunk_size=100)
    text = "Texto curto que cabe em um único chunk."
    chunks = splitter.split_text(text)
    assert len(chunks) == 1
    assert chunks[0] == text

def test_split_long_text_with_overlap():
    splitter = TiktokenTextSplitter(chunk_size=10, chunk_overlap=2)
    # Cada palavra é aproximadamente 1 a 2 tokens.
    text = "Esta é uma frase deliberadamente longa criada para testar a divisão de texto em múltiplos pedaços pequenos."
    chunks = splitter.split_text(text)
    
    assert len(chunks) > 1
    # Verifica se os chunks contêm partes do texto original
    assert all(len(c.strip()) > 0 for c in chunks)
    # Verifica que juntando e limpando o overlap temos a cobertura do texto (ou simplesmente que o texto original está representado)
    assert text[:10] in chunks[0]
