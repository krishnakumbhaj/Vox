# Complete FastAPI main.py - FIXED VERSION
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import pandas as pd
import httpx
import asyncio
from database_analyst_agent import DatabaseAnalystAgent
from config import Config

app = FastAPI(title="AI Database Analyst API", version="2.0.0")

# FIXED: Improved CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vox-phi.vercel.app",  # Removed trailing slash
        "http://localhost:3000",      # For local development
        "http://localhost:3001",      # Alternative local port
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Configuration
NEXTJS_API_URL = "https://vox-phi.vercel.app/api"
CHAT_SAVE_TIMEOUT = 30  # Increased timeout

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
    """FIXED: Improved dependency with better error handling"""
    global agent
    if agent is None:
        try:
            agent = DatabaseAnalystAgent()
        except Exception as e:
            # Log the error but don't fail immediately
            print(f"Warning: Failed to initialize agent: {str(e)}")
            # Return a mock agent or handle gracefully
            agent = None
    return agent

async def send_to_nextjs(endpoint: str, data: Dict[str, Any], method: str = "POST") -> Dict[str, Any]:
    """
    FIXED: Improved NextJS API communication with better error handling
    """
    try:
        url = f"{NEXTJS_API_URL}/{endpoint}"
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json"
        }
        
        async with httpx.AsyncClient(timeout=CHAT_SAVE_TIMEOUT) as client:
            if method.upper() == "POST":
                response = await client.post(url, json=data, headers=headers)
            elif method.upper() == "GET":
                response = await client.get(url, params=data, headers=headers)
            elif method.upper() == "DELETE":
                response = await client.delete(url, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            response.raise_for_status()  # Raises exception for HTTP errors
            
            try:
                result = response.json()
            except:
                # If response is not JSON, return success message
                result = {"success": True, "message": "Operation completed"}
            
            print(f"✅ NextJS API call successful: {endpoint}")
            return result
                
    except httpx.TimeoutException:
        print(f"⏰ Timeout calling NextJS API: {endpoint}")
        raise HTTPException(status_code=504, detail="NextJS API timeout")
    except httpx.HTTPStatusError as e:
        print(f"❌ HTTP error calling NextJS API: {e.response.status_code}")
        raise HTTPException(status_code=e.response.status_code, detail=f"NextJS API error: {e.response.text}")
    except Exception as e:
        print(f"❌ Error calling NextJS API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"NextJS API error: {str(e)}")

# FIXED: Added explicit OPTIONS handler for CORS preflight
@app.options("/{path:path}")
async def options_handler(path: str):
    """Handle CORS preflight requests"""
    return {"message": "OK"}

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "AI Database Analyst API v2.0", "status": "active"}

# FIXED: Added health check endpoint
@app.get("/health")
async def health_check():
    """Detailed health check"""
    try:
        agent_status = "initialized" if agent is not None else "not_initialized"
        return {
            "status": "healthy",
            "agent": agent_status,
            "api_version": "2.0.0"
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@app.get("/agent-info")
async def get_agent_info():
    """FIXED: Get agent info with better error handling"""
    try:
        current_agent = get_agent()
        if current_agent is None:
            return {"error": "Agent not initialized", "available": False}
        return current_agent.get_agent_info()
    except Exception as e:
        return {"error": str(e), "available": False}

@app.post("/connect", response_model=ConnectionStatus)
async def connect_database(connection: DatabaseConnection):
    """FIXED: Connect to database with improved error handling"""
    try:
        current_agent = get_agent()
        if current_agent is None:
            raise HTTPException(status_code=500, detail="Agent not initialized")
            
        connection_string = current_agent.create_connection_string(
            connection.db_type,
            connection.host,
            connection.port,
            connection.database,
            connection.username,
            connection.password
        )
        
        success, message = current_agent.connect_database(connection_string)
        
        if success:
            status = current_agent.get_connection_status()
            return ConnectionStatus(
                connected=status['connected'],
                tables_count=status['tables_count'],
                tables=status['tables'],
                message=message
            )
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

@app.get("/connection-status", response_model=ConnectionStatus)
async def get_connection_status():
    """FIXED: Get connection status with better error handling"""
    try:
        current_agent = get_agent()
        if current_agent is None:
            return ConnectionStatus(
                connected=False,
                tables_count=0,
                tables=[],
                message="Agent not initialized"
            )
            
        status = current_agent.get_connection_status()
        return ConnectionStatus(
            connected=status['connected'],
            tables_count=status['tables_count'],
            tables=status['tables'],
            message="Connected" if status['connected'] else "Not connected"
        )
    except Exception as e:
        return ConnectionStatus(
            connected=False,
            tables_count=0,
            tables=[],
            message=f"Error: {str(e)}"
        )

@app.get("/tables")
async def get_table_info():
    """FIXED: Get table info with improved error handling"""
    try:
        current_agent = get_agent()
        if current_agent is None:
            raise HTTPException(status_code=500, detail="Agent not initialized")
            
        if not current_agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")
        return current_agent.get_table_info()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest):
    """FIXED: Execute query with improved error handling"""
    try:
        current_agent = get_agent()
        if current_agent is None:
            return QueryResponse(
                success=False,
                response="",
                error="Agent not initialized"
            )
            
        if not current_agent.get_connection_status()['connected']:
            return QueryResponse(
                success=False,
                response="",
                error="No database connection"
            )

        print(f"🔍 Processing query for user: {request.user_id}, chat: {request.chat_id}")
        print(f"📝 Query: {request.query}")

        # Execute the query
        result = current_agent.execute_natural_language_query(request.query)

        # Convert DataFrame to list of dictionaries for JSON serialization
        data_list = None
        if result['data'] is not None and not result['data'].empty:
            data_list = result['data'].to_dict('records')

        # Prepare visualization data
        visualization_data = None
        if result['data'] is not None and not result['data'].empty:
            visualization_data = prepare_visualization_data(result['data'], request.query)

        print(f"✅ Query processed successfully: {result['success']}")

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
        print(f"❌ {error_msg}")
        return QueryResponse(
            success=False,
            response="",
            error=error_msg
        )

@app.post("/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest):
    """
    FIXED: Process chat with improved error handling
    """
    try:
        current_agent = get_agent()
        if current_agent is None:
            return ChatResponse(
                success=False,
                error="Agent not initialized. Please check server configuration.",
                response=""
            )

        # Check database connection
        if not current_agent.get_connection_status()['connected']:
            return ChatResponse(
                success=False,
                error="No database connection. Please connect to a database first.",
                response=""
            )

        print(f"🔍 Processing chat for user: {request.user_id}")
        print(f"📝 Message: {request.message}")

        # Execute the query
        result = current_agent.execute_natural_language_query(request.message)

        # Convert DataFrame to list of dictionaries
        data_list = None
        if result['data'] is not None and not result['data'].empty:
            data_list = result['data'].to_dict('records')

        # Prepare visualization data
        visualization_data = None
        if result['data'] is not None and not result['data'].empty:
            visualization_data = prepare_visualization_data(result['data'], request.message)

        # Try to save to NextJS, but don't fail if it doesn't work
        try:
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
            
        except HTTPException as e:
            # If NextJS saving fails, still return the query result
            print(f"⚠️ Failed to save to NextJS, but query succeeded: {e}")
            return ChatResponse(
                success=True,
                response=result['response'],
                error="Query succeeded but failed to save to database"
            )

    except Exception as e:
        error_msg = f"Chat processing failed: {str(e)}"
        print(f"❌ {error_msg}")
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
async def get_query_suggestions(partial_query: Optional[str] = ""):
    """FIXED: Get query suggestions with error handling"""
    try:
        current_agent = get_agent()
        if current_agent is None:
            return {"suggestions": []}
        return {"suggestions": current_agent.get_query_suggestions(partial_query)}
    except Exception as e:
        return {"suggestions": [], "error": str(e)}

@app.post("/disconnect")
async def disconnect_database():
    """FIXED: Disconnect with improved error handling"""
    try:
        current_agent = get_agent()
        if current_agent is None:
            return {"message": "Agent not initialized"}
        current_agent.disconnect()
        return {"message": "Disconnected successfully"}
    except Exception as e:
        return {"message": f"Disconnect failed: {str(e)}"}

# Chat management endpoints
@app.get("/user/{user_id}/chats")
async def get_user_chats(user_id: str):
    """Get all chats for a user"""
    try:
        response = await send_to_nextjs(f"user/{user_id}/chats", {}, "GET")
        return response
    except Exception as e:
        return {"chats": [], "error": str(e)}

@app.get("/chat/{chat_id}")
async def get_chat(chat_id: str):
    """Get specific chat with messages"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "GET")
        return response
    except Exception as e:
        return {"chat": None, "error": str(e)}

@app.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "DELETE")
        return response
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/test-nextjs-connection")
async def test_nextjs_connection():
    """Test NextJS API connectivity"""
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
        return {
            "success": False,
            "message": "NextJS connection failed",
            "error": str(e)
        }

# FIXED: Added CORS testing endpoint
@app.get("/test-cors")
async def test_cors():
    """Test CORS configuration"""
    return {
        "message": "CORS is working!",
        "timestamp": pd.Timestamp.now().isoformat(),
        "origin": "FastAPI Backend"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
