import pandas as pd

class QueryProcessor:
    """Handles natural language query processing and execution"""
    
    def __init__(self, database_manager):
        self.db_manager = database_manager
    
    def execute_natural_language_query(self, user_query):
        """Execute natural language query using LlamaIndex"""
        if not self.db_manager.connection_status:
            return {
                'response': "Please connect to a database first.",
                'sql_query': None,
                'data': None,
                'success': False
            }
        
        try:
            # Execute query using LlamaIndex
            response = self.db_manager.query_engine.query(user_query)
            
            # Get the SQL query that was generated (if available)
            sql_query = getattr(response, 'metadata', {}).get('sql_query', 'SQL query not available')
            
            # Try to extract SQL from response if not in metadata
            if sql_query == 'SQL query not available':
                response_str = str(response)
                if 'SELECT' in response_str.upper():
                    # Try to extract SQL from response
                    lines = response_str.split('\n')
                    for line in lines:
                        if 'SELECT' in line.upper():
                            sql_query = line.strip()
                            break
            
            # Execute the SQL to get raw data for visualization
            df = None
            if sql_query and sql_query != 'SQL query not available':
                df = self.db_manager.execute_raw_sql(sql_query)
            
            return {
                'response': str(response),
                'sql_query': sql_query,
                'data': df if df is not None and not df.empty else None,
                'success': True
            }
            
        except Exception as e:
            return {
                'response': f"Error executing query: {str(e)}",
                'sql_query': None,
                'data': None,
                'success': False
            }
    
    def validate_query(self, query):
        """Validate user query before processing"""
        if not query or not query.strip():
            return False, "Query cannot be empty"
        
        if len(query.strip()) < 5:
            return False, "Query too short"
        
        # Add more validation rules as needed
        return True, "Query is valid"
    
    def get_query_suggestions(self, partial_query):
        """Get query suggestions based on partial input"""
        suggestions = []
        
        # Basic suggestions based on partial query
        if "top" in partial_query.lower():
            suggestions.extend([
                "Show me top 10 customers by sales",
                "Show me top products by revenue"
            ])
        
        if "average" in partial_query.lower():
            suggestions.extend([
                "What's the average order value?",
                "What's the average customer lifetime value?"
            ])
        
        if "trend" in partial_query.lower():
            suggestions.extend([
                "Show me sales trends over time",
                "Show me customer acquisition trends"
            ])
        
        return suggestions