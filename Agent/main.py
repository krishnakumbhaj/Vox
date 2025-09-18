# Complete FastAPI main.py with improved error handling and debugging
from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import pandas as pd
import httpx
import asyncio
import traceback
import logging
from database_analyst_agent import DatabaseAnalystAgent
from config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="AI Database Analyst API", version="2.0.0")

# Add CORS middleware for NextJS frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vox-phi.vercel.app",  # Remove trailing slash!
        "https://*.vercel.app",  # Allow Vercel preview deployments
        "http://localhost:3000",  # For local development
        "http://127.0.0.1:3000",   # Alternative localhost
        "*"  # For debugging - remove in production
    ],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration - Using environment variables
import os
FASTAPI_URL = os.getenv("FASTAPI_URL", "https://vox-9xr7.onrender.com")  # Your Render URL (this app)
NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "https://vox-phi.vercel.app/api")  # Your Vercel API URL
CHAT_SAVE_TIMEOUT = 30  # Increased timeout

# Global agent instance
agent = None

# Exception handler for better error responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global exception handler: {str(exc)}")
    logger.error(f"Traceback: {traceback.format_exc()}")
    
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Internal server error: {str(exc)}",
            "type": "internal_error",
            "path": request.url.path
        }
    )

# Pydantic models for request/response
class DatabaseConnection(BaseModel):
    db_type: str
    host: str
    port: str
    database: str
    username: Optional[str] = None
    password: Optional[str] = None

class QueryRequest(BaseModel):
    query: str
    user_id: Optional[str] = None
    chat_id: Optional[str] = None

class QueryResponse(BaseModel):
    success: bool
    response: str
    sql_query: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None
    visualization_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    message_id: Optional[str] = None

class ConnectionStatus(BaseModel):
    connected: bool
    tables_count: int
    tables: List[str]
    message: str

class ChatRequest(BaseModel):
    message: str
    user_id: str
    chat_id: Optional[str] = None

class ChatResponse(BaseModel):
    success: bool
    message_id: Optional[str] = None
    chat_id: Optional[str] = None
    response: str
    error: Optional[str] = None

def get_agent():
    """Dependency to get or create agent instance"""
    global agent
    if agent is None:
        try:
            logger.info("Initializing DatabaseAnalystAgent...")
            agent = DatabaseAnalystAgent()
            logger.info("DatabaseAnalystAgent initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize agent: {str(e)}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize agent: {str(e)}")
    return agent

async def send_to_nextjs(endpoint: str, data: Dict[str, Any], method: str = "POST") -> Dict[str, Any]:
    """Send data to NextJS API with improved error handling"""
    try:
        url = f"{NEXTJS_API_URL}/{endpoint}"
        logger.info(f"Calling NextJS API: {method} {url}")
        
        async with httpx.AsyncClient(timeout=CHAT_SAVE_TIMEOUT) as client:
            if method.upper() == "POST":
                response = await client.post(url, json=data)
            elif method.upper() == "GET":
                response = await client.get(url, params=data)
            elif method.upper() == "DELETE":
                response = await client.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            logger.info(f"NextJS API response: {response.status_code}")
            
            if response.status_code == 200:
                result = response.json()
                logger.info(f"✅ NextJS API call successful: {endpoint}")
                return result
            else:
                error_text = response.text
                logger.error(f"❌ NextJS API error: {response.status_code} - {error_text}")
                raise HTTPException(
                    status_code=response.status_code, 
                    detail=f"NextJS API error: {error_text}"
                )
                
    except httpx.TimeoutException as e:
        logger.error(f"⏰ Timeout calling NextJS API: {endpoint}")
        raise HTTPException(status_code=504, detail="NextJS API timeout")
    except httpx.ConnectError as e:
        logger.error(f"🔌 Connection error calling NextJS API: {str(e)}")
        raise HTTPException(status_code=503, detail=f"NextJS API connection error: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Error calling NextJS API: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"NextJS API error: {str(e)}")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "AI Database Analyst API v2.0", "status": "active"}

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    try:
        # Test agent initialization
        test_agent = get_agent()
        
        return {
            "status": "healthy", 
            "message": "FastAPI backend is running",
            "agent_initialized": test_agent is not None,
            "timestamp": pd.Timestamp.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "message": f"Health check failed: {str(e)}",
            "agent_initialized": False,
            "timestamp": pd.Timestamp.now().isoformat()
        }

@app.get("/debug")
async def debug_info():
    """Debug endpoint to check configuration and dependencies"""
    try:
        debug_info = {
            "fastapi_url": FASTAPI_URL,
            "nextjs_api_url": NEXTJS_API_URL,
            "chat_save_timeout": CHAT_SAVE_TIMEOUT,
            "agent_initialized": agent is not None,
            "environment_vars": {
                "FASTAPI_URL": os.getenv("FASTAPI_URL", "Not set"),
                "NEXTJS_API_URL": os.getenv("NEXTJS_API_URL", "Not set"),
            }
        }
        
        # Test agent initialization
        try:
            test_agent = get_agent()
            debug_info["agent_status"] = "OK"
            debug_info["agent_info"] = test_agent.get_agent_info() if hasattr(test_agent, 'get_agent_info') else "No info method"
        except Exception as e:
            debug_info["agent_status"] = f"ERROR: {str(e)}"
        
        return debug_info
        
    except Exception as e:
        return {"error": str(e), "traceback": traceback.format_exc()}

@app.get("/agent-info")
async def get_agent_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get information about the agent capabilities"""
    try:
        return agent.get_agent_info()
    except Exception as e:
        logger.error(f"Error getting agent info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get agent info: {str(e)}")

@app.post("/connect", response_model=ConnectionStatus)
async def connect_database(connection: DatabaseConnection, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Connect to a database with improved error handling"""
    try:
        logger.info(f"Attempting to connect to {connection.db_type} database at {connection.host}:{connection.port}")
        
        # Validate required fields
        if not all([connection.db_type, connection.host, connection.port, connection.database]):
            raise HTTPException(status_code=400, detail="Missing required connection parameters")
        
        connection_string = agent.create_connection_string(
            connection.db_type,
            connection.host,
            connection.port,
            connection.database,
            connection.username,
            connection.password
        )
        
        logger.info(f"Connection string created: {connection_string[:50]}...")  # Log partial connection string
        
        success, message = agent.connect_database(connection_string)
        
        if success:
            status = agent.get_connection_status()
            logger.info(f"Database connected successfully. Tables found: {status['tables_count']}")
            return ConnectionStatus(
                connected=status['connected'],
                tables_count=status['tables_count'],
                tables=status['tables'],
                message=message
            )
        else:
            logger.error(f"Database connection failed: {message}")
            raise HTTPException(status_code=400, detail=message)
            
    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        error_msg = f"Connection failed: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=error_msg)

@app.get("/connection-status", response_model=ConnectionStatus)
async def get_connection_status(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get current database connection status"""
    try:
        status = agent.get_connection_status()
        return ConnectionStatus(
            connected=status['connected'],
            tables_count=status['tables_count'],
            tables=status['tables'],
            message="Connected" if status['connected'] else "Not connected"
        )
    except Exception as e:
        logger.error(f"Error getting connection status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tables")
async def get_table_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get information about database tables"""
    try:
        if not agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")
        return agent.get_table_info()
    except Exception as e:
        logger.error(f"Error getting table info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Execute natural language query with better error handling"""
    try:
        if not agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")

        logger.info(f"🔍 Processing query for user: {request.user_id}, chat: {request.chat_id}")
        logger.info(f"📝 Query: {request.query}")

        # Execute the query
        result = agent.execute_natural_language_query(request.query)

        # Convert DataFrame to list of dictionaries for JSON serialization
        data_list = None
        if result['data'] is not None:
            data_list = result['data'].to_dict('records')

        # Prepare visualization data
        visualization_data = None
        if result['data'] is not None and not result['data'].empty:
            visualization_data = prepare_visualization_data(result['data'], request.query)

        logger.info(f"✅ Query processed successfully: {result['success']}")

        return QueryResponse(
            success=result['success'],
            response=result['response'],
            sql_query=result['sql_query'],
            data=data_list,
            visualization_data=visualization_data,
            error=None if result['success'] else result['response']
        )

    except Exception as e:
        error_msg = f"Query execution failed: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        return QueryResponse(
            success=False,
            response="",
            error=error_msg
        )

@app.post("/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Process chat message and save to NextJS with better error handling"""
    try:
        # Check database connection
        if not agent.get_connection_status()['connected']:
            return ChatResponse(
                success=False,
                error="No database connection. Please connect to a database first.",
                response=""
            )

        logger.info(f"🔍 Processing chat for user: {request.user_id}")
        logger.info(f"📝 Message: {request.message}")

        # Execute the query
        result = agent.execute_natural_language_query(request.message)

        # Convert DataFrame to list of dictionaries
        data_list = None
        if result['data'] is not None:
            data_list = result['data'].to_dict('records')

        # Prepare visualization data
        visualization_data = None
        if result['data'] is not None and not result['data'].empty:
            visualization_data = prepare_visualization_data(result['data'], request.message)

        # Prepare data for NextJS
        chat_data = {
            "userId": request.user_id,
            "chatId": request.chat_id,
            "message": request.message,
            "response": result['response'],
            "sqlQuery": result.get('sql_query'),
            "data": data_list,
            "visualizationData": visualization_data,
            "success": result['success']
        }

        # Send to NextJS API to save
        if request.chat_id:
            nextjs_response = await send_to_nextjs(f"chat/{request.chat_id}", chat_data, "POST")
        else:
            nextjs_response = await send_to_nextjs("chat", chat_data, "POST")

        return ChatResponse(
            success=True,
            message_id=nextjs_response.get('messageId'),
            chat_id=nextjs_response.get('chatId'),
            response=result['response']
        )

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        error_msg = f"Chat processing failed: {str(e)}"
        logger.error(error_msg)
        logger.error(f"Traceback: {traceback.format_exc()}")
        return ChatResponse(
            success=False,
            error=error_msg,
            response=""
        )

def prepare_visualization_data(df: pd.DataFrame, query: str) -> Dict[str, Any]:
    """Prepare chart data configuration for frontend"""
    if df.empty or len(df.columns) < 2:
        return None

    query_lower = query.lower()
    df_viz = df.head(20)

    # Determine chart type based on query
    chart_type = "bar"  # default
    if any(keyword in query_lower for keyword in ['trend', 'time', 'month', 'year', 'date']):
        chart_type = "line"
    elif any(keyword in query_lower for keyword in ['distribution', 'count', 'percentage']) and len(df_viz) <= 10:
        chart_type = "pie"
    elif any(keyword in query_lower for keyword in ['top', 'highest', 'best', 'most']):
        chart_type = "bar"

    # Prepare chart data
    chart_data = {
        'type': chart_type,
        'data': df_viz.to_dict('records'),
        'columns': list(df_viz.columns),
        'x_axis': df_viz.columns[0],
        'y_axis': df_viz.columns[1] if len(df_viz.columns) > 1 else df_viz.columns[0],
        'title': f"Analysis: {query[:50]}{'...' if len(query) > 50 else ''}"
    }

    return chart_data

@app.get("/suggestions")
async def get_query_suggestions(partial_query: Optional[str] = "", agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get query suggestions"""
    try:
        return {"suggestions": agent.get_query_suggestions(partial_query)}
    except Exception as e:
        logger.error(f"Error getting suggestions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/disconnect")
async def disconnect_database(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Disconnect from database"""
    try:
        agent.disconnect()
        return {"message": "Disconnected successfully"}
    except Exception as e:
        logger.error(f"Error disconnecting: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Additional endpoints for chat management
@app.get("/user/{user_id}/chats")
async def get_user_chats(user_id: str):
    """Get all chats for a user"""
    try:
        response = await send_to_nextjs(f"user/{user_id}/chats", {}, "GET")
        return response
    except Exception as e:
        logger.error(f"Error getting user chats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/{chat_id}")
async def get_chat(chat_id: str):
    """Get specific chat with messages"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "GET")
        return response
    except Exception as e:
        logger.error(f"Error getting chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "DELETE")
        return response
    except Exception as e:
        logger.error(f"Error deleting chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-nextjs-connection")
async def test_nextjs_connection():
    """Test endpoint to verify NextJS API connectivity"""
    try:
        test_data = {
            "test": True,
            "message": "Connection test from FastAPI"
        }
        response = await send_to_nextjs("test", test_data, "POST")
        return {
            "success": True,
            "message": "NextJS connection successful",
            "response": response
        }
    except Exception as e:
        logger.error(f"NextJS connection test failed: {str(e)}")
        return {
            "success": False,
            "message": "NextJS connection failed",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
