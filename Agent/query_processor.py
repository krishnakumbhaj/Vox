import pandas as pd
import re

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
            # Enhance the query with clearer instructions for better responses
            enhanced_query = self._enhance_user_query(user_query)
            
            # Execute query using LlamaIndex
            response = self.db_manager.query_engine.query(enhanced_query)

            # Convert response object to string and format for Markdown output
            response_str = str(response)
            
            # Get the SQL query that was generated (if available)
            sql_query = getattr(response, 'metadata', {}).get('sql_query', None)
            
            print(f"📊 LlamaIndex response: {response_str[:200]}...")
            print(f"🔍 SQL from metadata: {sql_query}")

            # Try to extract SQL from response if not in metadata
            if not sql_query:
                if 'SELECT' in response_str.upper():
                    # Try to extract SQL from response
                    lines = response_str.split('\n')
                    for line in lines:
                        if 'SELECT' in line.upper():
                            sql_query = line.strip()
                            print(f"📝 Extracted SQL from response: {sql_query}")
                            break
            
            # If we have a valid SQL query, execute it ourselves to get clean data
            # This bypasses LlamaIndex's internal execution which might have issues
            if sql_query and 'SELECT' in sql_query.upper():
                try:
                    # First try the query as-is
                    df = self.db_manager.execute_raw_sql(sql_query)
                    print(f"✅ Successfully executed SQL. Got {len(df)} rows")
                    
                    # If no data and this is PostgreSQL, try with public schema
                    if df.empty and 'FROM user' in sql_query:
                        print("⚠️ No data with 'user' table. Trying 'public.user'...")
                        sql_query_with_schema = sql_query.replace('FROM user', 'FROM public.user')
                        df = self.db_manager.execute_raw_sql(sql_query_with_schema)
                        print(f"✅ With schema prefix: Got {len(df)} rows")
                        if not df.empty:
                            sql_query = sql_query_with_schema
                    
                    # If still no data, try to check if table has any rows at all
                    if df.empty:
                        print("🔍 Checking if table has any data...")
                        test_df = self.db_manager.execute_raw_sql("SELECT COUNT(*) as count FROM public.user")
                        print(f"📊 Table row count: {test_df.iloc[0]['count'] if not test_df.empty else 0}")
                    
                    # Create a better response based on the actual data
                    if not df.empty:
                        formatted_response = f"Here are the results from the user table:\n\n"
                        formatted_response += f"Found **{len(df)}** records with the following columns: "
                        formatted_response += ", ".join([f"**{col}**" for col in df.columns])
                    else:
                        formatted_response = "The query executed successfully, but no data was found in the table. The table might be empty."
                    
                    return {
                        'response': formatted_response,
                        'sql_query': sql_query,
                        'data': df if not df.empty else None,
                        'success': True
                    }
                except Exception as sql_error:
                    print(f"❌ SQL execution error: {str(sql_error)}")
                    formatted_response = f"Error executing the query: {str(sql_error)}"
                    
                    return {
                        'response': formatted_response,
                        'sql_query': sql_query,
                        'data': None,
                        'success': False
                    }
            
            # If no SQL was generated, use LlamaIndex's response
            formatted_response = self._format_response_markdown(response_str)

            # Check if this is an error/explanation response (not actual data query)
            is_error_response = self._is_error_or_explanation_response(formatted_response)

            # If it's an error/explanation response, don't return SQL or data
            if is_error_response:
                return {
                    'response': formatted_response,
                    'sql_query': None,
                    'data': None,
                    'success': True  # It's still "successful" - just not a data query
                }

            # Execute the SQL to get raw data for visualization
            df = None
            if sql_query and sql_query != 'SQL query not available':
                try:
                    df = self.db_manager.execute_raw_sql(sql_query)
                    print(f"✅ SQL executed successfully. Rows returned: {len(df) if df is not None else 0}")
                except Exception as sql_error:
                    print(f"❌ SQL execution error: {str(sql_error)}")
                    # If SQL execution fails, return the error
                    return {
                        'response': f"The SQL query failed to execute: {str(sql_error)}\n\nGenerated SQL: `{sql_query}`",
                        'sql_query': sql_query,
                        'data': None,
                        'success': False
                    }

            return {
                'response': formatted_response,
                'sql_query': sql_query if sql_query != 'SQL query not available' else None,
                'data': df if df is not None and not df.empty else None,
                'success': True
            }
            
        except Exception as e:
            print(f"❌ Query processor exception: {str(e)}")
            return {
                'response': f"Error executing query: {str(e)}",
                'sql_query': None,
                'data': None,
                'success': False
            }
    
    def _enhance_user_query(self, user_query: str) -> str:
        """Enhance user query with instructions for better LLM responses"""
        query_lower = user_query.lower()
        
        # For listing queries, add specific formatting instructions
        if any(keyword in query_lower for keyword in ['list', 'show', 'display', 'what are']):
            if 'table' in query_lower and 'column' not in query_lower and 'row' not in query_lower:
                # Listing tables
                return f"{user_query}. Format the response as a clean markdown list with each table on a new line using bullet points."
            elif 'column' in query_lower:
                # Listing columns
                return f"{user_query}. Show the columns in a clear markdown list format with bullet points."
            elif 'row' in query_lower or 'data' in query_lower or 'record' in query_lower:
                # Listing actual data
                return f"{user_query}. Present the data in a clear, organized format."
        
        # For count queries
        if any(keyword in query_lower for keyword in ['how many', 'count', 'number of']):
            return f"{user_query}. Provide a direct, concise answer with just the count."
        
        # For describe queries
        if any(keyword in query_lower for keyword in ['describe', 'structure', 'schema']):
            return f"{user_query}. Format the response as a well-organized markdown list showing each column with its type."
        
        # Default: return query as-is with general instruction
        return user_query
    
    def _is_error_or_explanation_response(self, response_text: str) -> bool:
        """Detect if response is an error/explanation rather than actual data query result.
        
        Returns True if the response is:
        - An error message
        - An explanation of why something can't be done
        - A clarification request
        - Any non-data response
        """
        if not response_text:
            return True
        
        response_lower = response_text.lower()
        
        # Common phrases that indicate this is NOT a data query response
        error_phrases = [
            'i cannot',
            'i can\'t',
            'unable to',
            'not able to',
            'cannot create',
            'cannot delete',
            'cannot update',
            'cannot modify',
            'cannot insert',
            'don\'t have',
            'do not have',
            'not available',
            'not found',
            'does not exist',
            'doesn\'t exist',
            'no data',
            'no information',
            'no records',
            'please provide',
            'please specify',
            'could you clarify',
            'need more information',
            'which table',
            'which column',
            'this tool is designed for',
            'i am designed to',
            'i\'m designed to',
            'only query',
            'read-only',
            'error:',
            'failed to'
        ]
        
        # Check if response contains any error phrases
        for phrase in error_phrases:
            if phrase in response_lower:
                return True
        
        # Check if response is very short (likely an explanation, not data)
        if len(response_text) < 50 and 'SELECT' not in response_text.upper():
            return True
        
        return False
    
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

    def _format_response_markdown(self, text: str) -> str:
        """Enhanced post-processing to convert various list formats into proper Markdown.

        Handles:
        1. Inline asterisk lists: "Here's a list: * Item A * Item B"
        2. Already formatted lists with asterisks: "* Item A\n* Item B"
        3. Colon-separated items: "Name: value\nName: value"
        """
        if not text or not isinstance(text, str):
            return text

        lines = text.split('\n')
        processed_lines = []
        
        for i, line in enumerate(lines):
            # Check if line starts with asterisk (already a list item from LLM)
            if re.match(r'^\s*\*\s+\*\*', line):  # "* **Name:**" pattern
                # Replace leading asterisk with markdown dash, preserve bold
                line = re.sub(r'^\s*\*\s+', '- ', line)
                processed_lines.append(line)
            elif re.match(r'^\s*\*\s+', line):  # "* Item" pattern
                # Replace leading asterisk with markdown dash
                line = re.sub(r'^\s*\*\s+', '- ', line)
                processed_lines.append(line)
            # Check if line has inline asterisks (e.g., "item * item * item")
            elif ' * ' in line and not line.strip().startswith('*'):
                # Split by asterisk and create proper list
                # But first check if this follows a colon (list introduction)
                if i > 0 and processed_lines and processed_lines[-1].strip().endswith(':'):
                    # Split inline list into separate lines
                    parts = [p.strip() for p in line.split(' * ') if p.strip()]
                    for part in parts:
                        processed_lines.append(f"- {part}")
                else:
                    # Keep as is but clean up spacing
                    processed_lines.append(line)
            else:
                # Regular line - keep as is
                processed_lines.append(line)
        
        # Join lines back
        result = '\n'.join(processed_lines)
        
        # Clean up: collapse multiple blank lines
        result = re.sub(r'\n{3,}', '\n\n', result)
        
        # Trim trailing/leading whitespace per line
        lines = [line.rstrip() for line in result.splitlines()]
        return '\n'.join(lines).strip()