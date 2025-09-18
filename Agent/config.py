import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Configuration management class"""
    
    @staticmethod
    def get_gemini_api_key():
        """Get Gemini API key from environment"""
        return os.getenv("GEMINI_API_KEY")
    
    @staticmethod
    def get_db_config():
        """Load database configuration from environment variables"""
        return {
            'db_type': os.getenv('DB_TYPE', 'postgresql'),
            'host': os.getenv('DB_HOST', 'localhost'),
            'port': os.getenv('DB_PORT', '5432'),
            'database': os.getenv('DB_NAME'),
            'username': os.getenv('DB_USER'),
            'password': os.getenv('DB_PASSWORD')
        }
    
    @staticmethod
    def get_sample_queries():
        """Get sample queries for the UI"""
        return [
            "Show me top 10 customers by total sales",
            "What's the average order value by month?",
            "Which products have the highest profit margins?",
            "Show me sales trends for the last 6 months",
            "What's the distribution of customers by region?"
        ]
    
    @staticmethod
    def get_example_env():
        """Get example .env file content"""
        return """
# Gemini API Configuration
GEMINI_API_KEY=your_gemini_api_key_here

# Database Configuration  
DB_TYPE=postgresql
DB_HOST=localhost
DB_PORT=5432
DB_NAME=your_database_name
DB_USER=your_username
DB_PASSWORD=your_password

# For SQLite (simpler setup)
# DB_TYPE=sqlite
# DB_NAME=path/to/your/database.db

# Note: If your password contains special characters like @, #, %, etc.
# they will be automatically URL-encoded by the application
        """
    
    @staticmethod
    def get_installation_requirements():
        """Get installation requirements"""
        return """
pip install streamlit
pip install llama-index
pip install llama-index-llms-gemini
pip install llama-index-embeddings-huggingface
pip install python-dotenv
pip install plotly
pip install pandas
pip install sqlalchemy
pip install psycopg2-binary  # PostgreSQL
pip install pymysql          # MySQL
pip install sentence-transformers  # For local embeddings
        """