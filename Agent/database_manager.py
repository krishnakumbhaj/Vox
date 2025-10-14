import pandas as pd
from sqlalchemy import create_engine, text, inspect
from llama_index.core import SQLDatabase, Settings
from llama_index.core.query_engine import NLSQLTableQueryEngine
from urllib.parse import quote_plus
import warnings
warnings.filterwarnings('ignore')

class DatabaseManager:
    """Handles database connections and operations"""
    
    def __init__(self):
        self.engine = None
        self.sql_database = None
        self.query_engine = None
        self.tables = []
        self.connection_status = False
    
    def create_connection_string(self, db_type, host, port, database, username, password):
        """Create connection string based on database type with proper URL encoding"""
        # URL encode the username and password to handle special characters
        if username:
            username = quote_plus(str(username))
        if password:
            password = quote_plus(str(password))
        
        connection_strings = {
            'postgresql': f"postgresql://{username}:{password}@{host}:{port}/{database}",
            'mysql': f"mysql+pymysql://{username}:{password}@{host}:{port}/{database}",
            'sqlite': f"sqlite:///{database}",
            'mssql': f"mssql+pyodbc://{username}:{password}@{host}:{port}/{database}?driver=ODBC+Driver+17+for+SQL+Server"
        }
        return connection_strings.get(db_type)
    
    def connect_database(self, connection_string):
        """Connect to database and initialize LlamaIndex components"""
        try:
            # Create SQLAlchemy engine
            self.engine = create_engine(connection_string)
            
            # Test connection
            with self.engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            
            # Get table names first
            inspector = inspect(self.engine)
            # For PostgreSQL, specify the public schema explicitly
            try:
                self.tables = inspector.get_table_names(schema='public')
                print(f"📋 Found {len(self.tables)} tables in 'public' schema: {self.tables}")
            except:
                # Fallback for other databases without schemas
                self.tables = inspector.get_table_names()
                print(f"📋 Found {len(self.tables)} tables: {self.tables}")
            
            if not self.tables:
                return False, "❌ No tables found in the database"
            
            # Create LlamaIndex SQL Database with all tables and include sample rows
            # This ensures the schema is properly detected with all columns
            self.sql_database = SQLDatabase(
                self.engine,
                include_tables=self.tables,
                sample_rows_in_table_info=3,  # Include 3 sample rows to help LLM understand the data
                view_support=False  # Disable views to focus on tables only
            )
            
            # Force refresh table info to ensure latest schema is loaded
            self.sql_database._all_table_names = None
            self.sql_database._usable_tables = set(self.tables)
            
            # Print the actual table info that will be used for debugging
            print("\n=== Table Info for LLM ===")
            for table in self.tables:
                try:
                    table_info = self.sql_database.get_single_table_info(table)
                    print(f"\nTable '{table}' schema info:")
                    print(table_info[:500])  # Print first 500 chars
                except Exception as e:
                    print(f"Could not get table info for '{table}': {e}")
            print("\n==========================\n")
            
            # Create query engine with all tables explicitly specified
            # Use verbose mode to see actual SQL generation
            self.query_engine = NLSQLTableQueryEngine(
                sql_database=self.sql_database,
                tables=self.tables,
                verbose=True,
                synthesize_response=True
            )
            
            # Print schema info for debugging
            print("\n=== Database Schema Loaded ===")
            for table in self.tables:
                try:
                    columns = inspector.get_columns(table)
                    col_names = [col['name'] for col in columns]
                    print(f"Table '{table}': {', '.join(col_names)}")
                except Exception as e:
                    print(f"Could not read columns for '{table}': {e}")
            print("==============================\n")
            
            self.connection_status = True
            return True, f"✅ Connected successfully! Found {len(self.tables)} tables."
            
        except Exception as e:
            self.connection_status = False
            return False, f"❌ Connection failed: {str(e)}"
    
    def connect_from_config(self, config):
        """Connect to database using configuration dictionary"""
        # Validate required fields
        if not config['database']:
            return False, "❌ Database name is required"
        
        if config['db_type'] != 'sqlite':
            if not config['username']:
                return False, "❌ Username is required"
            if not config['password']:
                return False, "❌ Password is required"
        
        connection_string = self.create_connection_string(
            config['db_type'], config['host'], config['port'], 
            config['database'], config['username'], config['password']
        )
        
        return self.connect_database(connection_string)
    
    def get_table_info(self):
        """Get information about all tables"""
        if not self.connection_status:
            return []
        
        table_info = []
        inspector = inspect(self.engine)
        
        for table_name in self.tables:
            try:
                columns = inspector.get_columns(table_name)
                column_info = [f"{col['name']} ({col['type']})" for col in columns]
                table_info.append({
                    'table': table_name,
                    'columns': column_info,
                    'column_count': len(column_info)
                })
            except Exception as e:
                # Note: In a real app, you might want to use proper logging
                print(f"Could not get info for table {table_name}: {str(e)}")
        
        return table_info
    
    def execute_raw_sql(self, sql_query):
        """Execute raw SQL query and return DataFrame"""
        try:
            with self.engine.connect() as conn:
                df = pd.read_sql(sql_query, conn)
            return df
        except Exception as e:
            print(f"Error executing SQL: {str(e)}")
            return pd.DataFrame()
    
    def refresh_schema(self):
        """Refresh the database schema and query engine (useful after data imports)"""
        if not self.connection_status or not self.engine:
            return False, "❌ Not connected to database"
        
        try:
            # Re-inspect tables
            inspector = inspect(self.engine)
            self.tables = inspector.get_table_names()
            
            # Recreate SQL Database with refreshed schema
            self.sql_database = SQLDatabase(
                self.engine,
                include_tables=self.tables,
                sample_rows_in_table_info=2
            )
            
            # Recreate query engine
            self.query_engine = NLSQLTableQueryEngine(
                sql_database=self.sql_database,
                tables=self.tables,
                verbose=True,
                synthesize_response=True
            )
            
            print("\n=== Schema Refreshed ===")
            for table in self.tables:
                try:
                    columns = inspector.get_columns(table)
                    col_names = [col['name'] for col in columns]
                    print(f"Table '{table}': {', '.join(col_names)}")
                except Exception as e:
                    print(f"Could not read columns for '{table}': {e}")
            print("========================\n")
            
            return True, "✅ Schema refreshed successfully"
            
        except Exception as e:
            return False, f"❌ Failed to refresh schema: {str(e)}"
    
    def disconnect(self):
        """Disconnect from database"""
        if self.engine:
            self.engine.dispose()
        self.engine = None
        self.sql_database = None
        self.query_engine = None
        self.tables = []
        self.connection_status = False