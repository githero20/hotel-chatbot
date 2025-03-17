# Use the official ChromaDB image
FROM ghcr.io/chroma-core/chroma:latest

# Expose the default ChromaDB port
EXPOSE 8000

# Start ChromaDB when the container runs
CMD ["chromadb", "run", "--host", "0.0.0.0", "--port", "8000"]