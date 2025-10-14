from database_manager import DatabaseManager
from llm_manager import LLMManager
from query_processor import QueryProcessor
# from visualization_manager import VisualizationManager
from config import Config

class DatabaseAnalystAgent:
    """Main agent class that orchestrates all components"""
    
    def __init__(self):
        self.database_manager = DatabaseManager()
        self.query_processor = QueryProcessor(self.database_manager)
        # self.visualization_manager = VisualizationManager()
        
        # Initialize LLM and embeddings
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize LLM and embedding models"""
        try:
            LLMManager.initialize_models()
        except Exception as e:
            raise Exception(f"Failed to initialize models: {str(e)}")
    
    def connect_from_env(self):
        """Connect to database using environment variables"""
        config = Config.get_db_config()
        return self.database_manager.connect_from_config(config)
    
    def connect_database(self, connection_string):
        """Connect to database using connection string"""
        return self.database_manager.connect_database(connection_string)
    
    def create_connection_string(self, db_type, host, port, database, username, password):
        """Create connection string for database"""
        return self.database_manager.create_connection_string(
            db_type, host, port, database, username, password
        )
    
    def get_table_info(self):
        """Get information about database tables"""
        return self.database_manager.get_table_info()
    
    def execute_natural_language_query(self, user_query):
        """Execute natural language query and return results with visualization"""
        # Validate query
        is_valid, message = self.query_processor.validate_query(user_query)
        if not is_valid:
            return {
                'response': f"Invalid query: {message}",
                'sql_query': None,
                'data': None,
                'success': False,
                'visualization': None
            }
        
        # Execute query
        result = self.query_processor.execute_natural_language_query(user_query)
        
        # Add visualization if data is available
        if result['success'] and result['data'] is not None:
            # visualization = self.visualization_manager.create_visualization(
            #     result['data'], user_query
            # )
            result['visualization'] = None  # Placeholder until visualization_manager is available
        else:
            result['visualization'] = None
        
        return result
    
    def get_query_suggestions(self, partial_query=""):
        """Get query suggestions"""
        if partial_query:
            return self.query_processor.get_query_suggestions(partial_query)
        else:
            return Config.get_sample_queries()
    
    def get_connection_status(self):
        """Get current database connection status"""
        return {
            'connected': self.database_manager.connection_status,
            'tables_count': len(self.database_manager.tables),
            'tables': self.database_manager.tables
        }
    
    def refresh_schema(self):
        """Refresh database schema after data import"""
        return self.database_manager.refresh_schema()
    
    def disconnect(self):
        """Disconnect from database"""
        self.database_manager.disconnect()
    
    def get_agent_info(self):
        """Get information about the agent and its capabilities"""
        return {
            'name': "AI Database Analyst Agent",
            'version': "1.0.0",
            'capabilities': [
                "Natural language database queries",
                "Automatic SQL generation",
                "Data visualization",
                "Multi-database support",
                "Real-time query processing"
            ],
            'supported_databases': ["PostgreSQL", "MySQL", "SQLite", "SQL Server"],
            'models': LLMManager.get_model_info(),
            # 'chart_types': VisualizationManager.get_supported_chart_types()
            'chart_types': []  # Placeholder until visualization_manager is available
        }