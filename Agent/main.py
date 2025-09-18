# Complete FastAPI main.py - Fixed Version
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import pandas as pd
import httpx
import asyncio
import os
import logging
from database_analyst_agent import DatabaseAnalystAgent
from config import Config

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI Database Analyst API", 
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuration - Using environment variables
FASTAPI_URL = os.getenv("FASTAPI_URL", "https://vox-9xr7.onrender.com")
NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "https://vox-phi.vercel.app/api")
CHAT_SAVE_TIMEOUT = 30  # Increased timeout
ENVIRONMENT = os.getenv("ENVIRONMENT", "production")

# Enhanced CORS configuration
if ENVIRONMENT == "development":
    # Development CORS - more permissive
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:3000",
            "http://127.0.0.1:3000",
            "http://localhost:3001",
            "https://vox-phi.vercel.app"
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Accept-Language",
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers",
        ],
        expose_headers=["*"]
    )
else:
    # Production CORS - more restrictive but functional
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "https://vox-phi.vercel.app",
            "https://*.vercel.app",
            "https://vox-phi-*.vercel.app",  # Vercel preview deployments
        ],
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=[
            "Accept",
            "Accept-Language", 
            "Content-Language",
            "Content-Type",
            "Authorization",
            "X-Requested-With",
            "Origin",
            "Access-Control-Request-Method",
            "Access-Control-Request-Headers",
        ],
        expose_headers=["*"],
        max_age=600  # Cache preflight for 10 minutes
    )

# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=[
        "vox-9xr7.onrender.com",
        "localhost", 
        "127.0.0.1",
        "*.onrender.com"
    ]
)

# Global agent instance
agent = None

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
            agent = DatabaseAnalystAgent()
            logger.info("Agent initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize agent: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to initialize agent: {str(e)}")
    return agent

async def send_to_nextjs(endpoint: str, data: Dict[str, Any], method: str = "POST") -> Dict[str, Any]:
    """
    Send data to NextJS API with better error handling and retries
    """
    max_retries = 3
    retry_delay = 1
    
    for attempt in range(max_retries):
        try:
            url = f"{NEXTJS_API_URL}/{endpoint}"
            logger.info(f"Attempting to call NextJS API: {url} (attempt {attempt + 1})")
            
            # Create headers
            headers = {
                "Content-Type": "application/json",
                "User-Agent": "FastAPI-Backend/2.0.0"
            }
            
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(connect=10.0, read=CHAT_SAVE_TIMEOUT, write=10.0, pool=10.0),
                headers=headers
            ) as client:
                
                if method.upper() == "POST":
                    response = await client.post(url, json=data)
                elif method.upper() == "GET":
                    response = await client.get(url, params=data)
                elif method.upper() == "DELETE":
                    response = await client.delete(url)
                else:
                    raise ValueError(f"Unsupported method: {method}")
                
                logger.info(f"NextJS API response status: {response.status_code}")
                
                if response.status_code == 200:
                    result = response.json()
                    logger.info(f"✅ NextJS API call successful: {endpoint}")
                    return result
                else:
                    logger.error(f"NextJS API error: {response.status_code} - {response.text}")
                    if attempt == max_retries - 1:  # Last attempt
                        raise HTTPException(
                            status_code=response.status_code, 
                            detail=f"NextJS API error: {response.text}"
                        )
                    
        except httpx.TimeoutException:
            logger.warning(f"⏰ Timeout calling NextJS API: {endpoint} (attempt {attempt + 1})")
            if attempt == max_retries - 1:  # Last attempt
                raise HTTPException(status_code=504, detail="NextJS API timeout after retries")
            
        except httpx.ConnectError as e:
            logger.error(f"Connection error to NextJS API: {str(e)} (attempt {attempt + 1})")
            if attempt == max_retries - 1:  # Last attempt
                raise HTTPException(status_code=503, detail=f"Cannot connect to NextJS API: {str(e)}")
                
        except Exception as e:
            logger.error(f"❌ Error calling NextJS API: {str(e)} (attempt {attempt + 1})")
            if attempt == max_retries - 1:  # Last attempt
                raise HTTPException(status_code=500, detail=f"NextJS API error: {str(e)}")
        
        # Wait before retrying
        if attempt < max_retries - 1:
            await asyncio.sleep(retry_delay)
            retry_delay *= 2  # Exponential backoff

# Add OPTIONS handler for all routes
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle preflight OPTIONS requests"""
    return {"status": "ok"}

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "AI Database Analyst API v2.0", 
        "status": "active",
        "environment": ENVIRONMENT,
        "cors_configured": True
    }

@app.get("/health")
async def health_check():
    """Enhanced health check endpoint"""
    try:
        # Test agent initialization
        agent_status = "healthy"
        try:
            get_agent()
        except Exception as e:
            agent_status = f"error: {str(e)}"
        
        return {
            "status": "healthy",
            "message": "FastAPI backend is running",
            "environment": ENVIRONMENT,
            "agent_status": agent_status,
            "nextjs_api_url": NEXTJS_API_URL,
            "fastapi_url": FASTAPI_URL
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Health check failed: {str(e)}")

@app.get("/agent-info")
async def get_agent_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get information about the agent capabilities"""
    try:
        return agent.get_agent_info()
    except Exception as e:
        logger.error(f"Failed to get agent info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get agent info: {str(e)}")

@app.post("/connect", response_model=ConnectionStatus)
async def connect_database(connection: DatabaseConnection, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Connect to a database"""
    try:
        logger.info(f"Attempting to connect to {connection.db_type} database")
        
        connection_string = agent.create_connection_string(
            connection.db_type,
            connection.host,
            connection.port,
            connection.database,
            connection.username,
            connection.password
        )
        
        success, message = agent.connect_database(connection_string)
        
        if success:
            status = agent.get_connection_status()
            logger.info(f"Database connected successfully: {status['tables_count']} tables found")
            return ConnectionStatus(
                connected=status['connected'],
                tables_count=status['tables_count'],
                tables=status['tables'],
                message=message
            )
        else:
            logger.error(f"Database connection failed: {message}")
            raise HTTPException(status_code=400, detail=message)
            
    except Exception as e:
        logger.error(f"Database connection error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

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
        logger.error(f"Failed to get connection status: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tables")
async def get_table_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get information about database tables"""
    try:
        if not agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")
        
        table_info = agent.get_table_info()
        logger.info(f"Retrieved table info for {len(table_info)} tables")
        return table_info
    except Exception as e:
        logger.error(f"Failed to get table info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Execute natural language query"""
    try:
        if not agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")

        logger.info(f"🔍 Processing query for user: {request.user_id}, chat: {request.chat_id}")
        logger.info(f"📝 Query: {request.query[:100]}{'...' if len(request.query) > 100 else ''}")

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
        logger.error(f"❌ {error_msg}")
        return QueryResponse(
            success=False,
            response="",
            error=error_msg
        )

@app.post("/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """
    Process chat message and save to NextJS
    """
    try:
        # Check database connection
        if not agent.get_connection_status()['connected']:
            return ChatResponse(
                success=False,
                error="No database connection. Please connect to a database first.",
                response=""
            )

        logger.info(f"🔍 Processing chat for user: {request.user_id}")
        logger.info(f"📝 Message: {request.message[:100]}{'...' if len(request.message) > 100 else ''}")

        # Execute the query
        result = agent.execute_natural_language_query(request.message)

        # Convert DataFrame to list of dictionaries for JSON serialization
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
        try:
            if request.chat_id:
                # Add message to existing chat
                nextjs_response = await send_to_nextjs(f"chat/{request.chat_id}", chat_data, "POST")
            else:
                # Create new chat
                nextjs_response = await send_to_nextjs("chat", chat_data, "POST")

            return ChatResponse(
                success=True,
                message_id=nextjs_response.get('messageId'),
                chat_id=nextjs_response.get('chatId'),
                response=result['response']
            )
        except HTTPException as he:
            # If NextJS API fails, still return the query result
            logger.warning(f"NextJS API failed but returning query result: {str(he)}")
            return ChatResponse(
                success=True,
                message_id=None,
                chat_id=request.chat_id,
                response=result['response']
            )

    except Exception as e:
        error_msg = f"Chat processing failed: {str(e)}"
        logger.error(f"❌ {error_msg}")
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
    df_viz = df.head(20)  # Limit for visualization

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
        suggestions = agent.get_query_suggestions(partial_query)
        return {"suggestions": suggestions}
    except Exception as e:
        logger.error(f"Failed to get suggestions: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/disconnect")
async def disconnect_database(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Disconnect from database"""
    try:
        agent.disconnect()
        logger.info("Database disconnected successfully")
        return {"message": "Disconnected successfully"}
    except Exception as e:
        logger.error(f"Failed to disconnect: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Additional endpoints for chat management
@app.get("/user/{user_id}/chats")
async def get_user_chats(user_id: str):
    """Get all chats for a user"""
    try:
        response = await send_to_nextjs(f"user/{user_id}/chats", {}, "GET")
        return response
    except Exception as e:
        logger.error(f"Failed to get user chats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/{chat_id}")
async def get_chat(chat_id: str):
    """Get specific chat with messages"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "GET")
        return response
    except Exception as e:
        logger.error(f"Failed to get chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "DELETE")
        return response
    except Exception as e:
        logger.error(f"Failed to delete chat: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/test-nextjs-connection")
async def test_nextjs_connection():
    """Test endpoint to verify NextJS API connectivity"""
    try:
        test_data = {
            "test": True,
            "message": "Connection test from FastAPI",
            "timestamp": pd.Timestamp.now().isoformat()
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

# Additional debugging endpoints
@app.get("/debug/cors")
async def debug_cors():
    """Debug CORS configuration"""
    return {
        "environment": ENVIRONMENT,
        "fastapi_url": FASTAPI_URL,
        "nextjs_api_url": NEXTJS_API_URL,
        "cors_origins": [
            "https://vox-phi.vercel.app",
            "https://*.vercel.app" if ENVIRONMENT == "production" else "http://localhost:3000",
        ]
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(
        app, 
        host="0.0.0.0", 
        port=port, 
        reload=ENVIRONMENT == "development",
        log_level="info"
    )
