from llama_index.core import Settings
from llama_index.llms.gemini import Gemini
from llama_index.embeddings.gemini import GeminiEmbedding
from config import Config

class LLMManager:
    """Manages LLM and embedding model initialization"""
    
    @staticmethod
    def initialize_models():
        """Initialize Gemini LLM and Gemini embeddings with API key from config"""
        gemini_api_key = Config.get_gemini_api_key()
        if not gemini_api_key:
            raise ValueError("GEMINI_API_KEY not found in .env file. Please add your Gemini API key to the .env file.")
            
        try:
            # Initialize Gemini LLM with optimized settings
            Settings.llm = Gemini(
                model="models/gemini-2.5-flash",
                api_key=gemini_api_key,
                temperature=0.1,  # Lower temperature for more focused, consistent responses
                max_tokens=1024   # Sufficient for SQL queries and responses
            )
            
            # Initialize Gemini embeddings (free tier)
            Settings.embed_model = GeminiEmbedding(
                model_name="models/text-embedding-004",
                api_key=gemini_api_key
            )
            
            return True, "✅ LLM and embeddings initialized successfully"
            
        except Exception as e:
            raise Exception(f"Failed to initialize LLM/Embeddings: {str(e)}")
    
    @staticmethod
    def get_model_info():
        """Get information about current models"""
        return {
            'llm_model': "gemini-1.5-flash",
            'embedding_model': "models/text-embedding-004"
        }
