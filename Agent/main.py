# Complete FastAPI main.py
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
import pandas as pd
import httpx
import asyncio
import json
from database_analyst_agent import DatabaseAnalystAgent
from config import Config

app = FastAPI(title="AI Database Analyst API", version="2.0.0")

# Add CORS middleware for NextJS frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://vox-phi.vercel.app",  # Remove trailing slash!
        "https://*.vercel.app",  # Allow Vercel preview deployments
        "http://localhost:3000",  # For local development
        "http://127.0.0.1:3000"   # Alternative localhost
    ],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration - Using environment variables
import os
FASTAPI_URL = os.getenv("FASTAPI_URL", "https://vox-9xr7.onrender.com")  # Your Render URL (this app)
NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "https://vox-phi.vercel.app/api")  # Your Vercel API URL
CHAT_SAVE_TIMEOUT = 10  # seconds

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
    user_id: Optional[str] = None  # For logging purposes
    chat_id: Optional[str] = None  # For reference

class QueryResponse(BaseModel):
    success: bool
    response: str
    sql_query: Optional[str] = None
    data: Optional[List[Dict[str, Any]]] = None
    visualization_data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    message_id: Optional[str] = None  # Added for message tracking

class ConnectionStatus(BaseModel):
    connected: bool
    tables_count: int
    tables: List[str]
    message: str

class ChatRequest(BaseModel):
    message: str
    user_id: str
    chat_id: Optional[str] = None  # If None, create new chat

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
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to initialize agent: {str(e)}")
    return agent

async def send_to_nextjs(endpoint: str, data: Dict[str, Any], method: str = "POST") -> Dict[str, Any]:
    """
    Send data to NextJS API
    Returns response data or raises exception
    """
    try:
        url = f"{NEXTJS_API_URL}/{endpoint}"
        async with httpx.AsyncClient(timeout=CHAT_SAVE_TIMEOUT) as client:
            if method.upper() == "POST":
                response = await client.post(url, json=data)
            elif method.upper() == "GET":
                response = await client.get(url, params=data)
            elif method.upper() == "DELETE":
                response = await client.delete(url)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code == 200:
                result = response.json()
                print(f"✅ NextJS API call successful: {endpoint}")
                return result
            else:
                print(f"❌ NextJS API error: {response.status_code} - {response.text}")
                raise HTTPException(status_code=response.status_code, detail=f"NextJS API error: {response.text}")
                
    except httpx.TimeoutException:
        print(f"⏰ Timeout calling NextJS API: {endpoint}")
        raise HTTPException(status_code=504, detail="NextJS API timeout")
    except Exception as e:
        print(f"❌ Error calling NextJS API: {str(e)}")
        raise HTTPException(status_code=500, detail=f"NextJS API error: {str(e)}")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "AI Database Analyst API v2.0", "status": "active"}

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "message": "FastAPI backend is running"}

@app.get("/agent-info")
async def get_agent_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get information about the agent capabilities"""
    return agent.get_agent_info()

@app.post("/connect", response_model=ConnectionStatus)
async def connect_database(connection: DatabaseConnection, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Connect to a database"""
    try:
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
            return ConnectionStatus(
                connected=status['connected'],
                tables_count=status['tables_count'],
                tables=status['tables'],
                message=message
            )
        else:
            raise HTTPException(status_code=400, detail=message)
            
    except Exception as e:
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
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tables")
async def get_table_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get information about database tables"""
    try:
        if not agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")
        return agent.get_table_info()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/refresh-schema")
async def refresh_schema(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Refresh database schema (useful after importing data)"""
    try:
        if not agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")
        
        success, message = agent.refresh_schema()
        
        if success:
            status = agent.get_connection_status()
            return {
                "success": True,
                "message": message,
                "tables_count": status['tables_count'],
                "tables": status['tables']
            }
        else:
            raise HTTPException(status_code=500, detail=message)
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh schema: {str(e)}")

@app.post("/query")
async def execute_query(request: QueryRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Execute natural language query with streaming response"""
    
    async def generate_stream():
        try:
            if not agent.get_connection_status()['connected']:
                yield f"data: {json.dumps({'type': 'error', 'content': 'No database connection'})}\n\n"
                return

            # Log the request for debugging
            print(f"🔍 Processing query for user: {request.user_id}, chat: {request.chat_id}")
            print(f"📝 Query: {request.query}")

            # Execute the query
            result = agent.execute_natural_language_query(request.query)

            # Stream the text response character by character
            response_text = result['response']
            yield f"data: {json.dumps({'type': 'start'})}\n\n"
            
            # Stream text in chunks of 3-5 characters for smooth animation
            chunk_size = 4
            for i in range(0, len(response_text), chunk_size):
                chunk = response_text[i:i+chunk_size]
                yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"
                await asyncio.sleep(0.02)  # Small delay for streaming effect
            
            yield f"data: {json.dumps({'type': 'text_complete'})}\n\n"

            # Stream SQL query if available
            if result['sql_query']:
                await asyncio.sleep(0.1)  # Brief pause before SQL
                yield f"data: {json.dumps({'type': 'sql', 'content': result['sql_query']})}\n\n"

            # Stream data if available
            if result['data'] is not None:
                data_list = result['data'].to_dict('records')
                
                # Prepare visualization data
                visualization_data = None
                if not result['data'].empty:
                    visualization_data = prepare_visualization_data(result['data'], request.query)
                
                await asyncio.sleep(0.1)  # Brief pause before data
                yield f"data: {json.dumps({'type': 'data', 'content': data_list, 'visualization': visualization_data})}\n\n"

            # Final success message
            yield f"data: {json.dumps({'type': 'complete', 'success': result['success']})}\n\n"
            print(f"✅ Query processed successfully: {result['success']}")

        except Exception as e:
            error_msg = f"Query execution failed: {str(e)}"
            print(f"❌ {error_msg}")
            yield f"data: {json.dumps({'type': 'error', 'content': error_msg})}\n\n"
    
    return StreamingResponse(
        generate_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable buffering for nginx
        }
    )

@app.post("/chat", response_model=ChatResponse)
async def process_chat(request: ChatRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """
    Process chat message and save to NextJS
    This endpoint handles the complete flow: Query -> Process -> Save -> Respond
    """
    try:
        # Check database connection
        if not agent.get_connection_status()['connected']:
            return ChatResponse(
                success=False,
                error="No database connection. Please connect to a database first.",
                response=""
            )

        print(f"🔍 Processing chat for user: {request.user_id}")
        print(f"📝 Message: {request.message}")

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
            "chatId": request.chat_id,  # Can be None for new chat
            "message": request.message,
            "response": result['response'],
            "sqlQuery": result.get('sql_query'),
            "data": data_list,
            "visualizationData": visualization_data,
            "success": result['success']
        }

        # Send to NextJS API to save
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

    except HTTPException:
        # Re-raise HTTP exceptions (from NextJS API calls)
        raise
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
async def get_query_suggestions(partial_query: Optional[str] = "", agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Get query suggestions"""
    try:
        return {"suggestions": agent.get_query_suggestions(partial_query)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/disconnect")
async def disconnect_database(agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Disconnect from database"""
    try:
        agent.disconnect()
        return {"message": "Disconnected successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Additional endpoints for chat management
@app.get("/user/{user_id}/chats")
async def get_user_chats(user_id: str):
    """Get all chats for a user"""
    try:
        response = await send_to_nextjs(f"user/{user_id}/chats", {}, "GET")
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/chat/{chat_id}")
async def get_chat(chat_id: str):
    """Get specific chat with messages"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "GET")
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/chat/{chat_id}")
async def delete_chat(chat_id: str):
    """Delete a chat"""
    try:
        response = await send_to_nextjs(f"chat/{chat_id}", {}, "DELETE")
        return response
    except Exception as e:
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
        return {
            "success": False,
            "message": "NextJS connection failed",
            "error": str(e)
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
