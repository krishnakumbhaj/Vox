# from fastapi import FastAPI, HTTPException, Depends
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# from typing import Optional, Dict, List, Any
# import pandas as pd
# import httpx
# import asyncio
# from database_analyst_agent import DatabaseAnalystAgent
# from config import Config

# app = FastAPI(title="AI Database Analyst API", version="1.0.0")

# # Add CORS middleware for NextJS frontend
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["http://localhost:3000"],  # NextJS default port
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Configuration
# NEXTJS_API_URL = "http://localhost:3000/api"  # Updated base URL
# CHAT_SAVE_TIMEOUT = 5  # seconds

# # Global agent instance
# agent = None

# # Pydantic models for request/response
# class DatabaseConnection(BaseModel):
#     db_type: str
#     host: str
#     port: str
#     database: str
#     username: Optional[str] = None
#     password: Optional[str] = None

# class QueryRequest(BaseModel):
#     query: str
#     user_id: Optional[str] = None  # For NextJS to track users
#     chat_id: Optional[str] = None  # Add chat_id field for specific chat sessions

# class QueryResponse(BaseModel):
#     success: bool
#     response: str
#     sql_query: Optional[str] = None
#     data: Optional[List[Dict[str, Any]]] = None
#     visualization_data: Optional[Dict[str, Any]] = None
#     error: Optional[str] = None
#     chat_saved: Optional[bool] = None  # Indicates if chat was saved successfully

# class ConnectionStatus(BaseModel):
#     connected: bool
#     tables_count: int
#     tables: List[str]
#     message: str

# def get_agent():
#     """Dependency to get or create agent instance"""
#     global agent
#     if agent is None:
#         try:
#             agent = DatabaseAnalystAgent()
#         except Exception as e:
#             raise HTTPException(status_code=500, detail=f"Failed to initialize agent: {str(e)}")
#     return agent

# async def save_chat_to_nextjs(chat_data: Dict[str, Any]) -> bool:
#     """
#     Save chat data to NextJS API
#     Returns True if successful, False otherwise
#     """
#     try:
#         # Use specific chat endpoint instead of general chat endpoint
#         chat_id = chat_data.get('chatId')
#         if not chat_id:
#             print("❌ No chatId provided for saving")
#             return False
            
#         url = f"{NEXTJS_API_URL}/chat/{chat_id}"
        
#         async with httpx.AsyncClient(timeout=CHAT_SAVE_TIMEOUT) as client:
#             response = await client.post(url, json=chat_data)
            
#             if response.status_code == 200:
#                 result = response.json()
#                 if result.get('success'):
#                     print(f"✅ Chat saved successfully: {result.get('messageId')}")
#                     return True
#                 else:
#                     print(f"❌ Chat save failed: {result.get('error')}")
#                     return False
#             else:
#                 print(f"❌ HTTP error saving chat: {response.status_code}")
#                 return False
                
#     except httpx.TimeoutException:
#         print("⏰ Timeout saving chat to NextJS API")
#         return False
#     except Exception as e:
#         print(f"❌ Error saving chat: {str(e)}")
#         return False

# @app.get("/")
# async def root():
#     """Health check endpoint"""
#     return {"message": "AI Database Analyst API", "status": "active"}

# @app.get("/agent-info")
# async def get_agent_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
#     """Get information about the agent capabilities"""
#     return agent.get_agent_info()

# @app.post("/connect", response_model=ConnectionStatus)
# async def connect_database(connection: DatabaseConnection, agent: DatabaseAnalystAgent = Depends(get_agent)):
#     """Connect to a database"""
#     try:
#         connection_string = agent.create_connection_string(
#             connection.db_type,
#             connection.host,
#             connection.port,
#             connection.database,
#             connection.username,
#             connection.password
#         )
        
#         success, message = agent.connect_database(connection_string)
        
#         if success:
#             status = agent.get_connection_status()
#             return ConnectionStatus(
#                 connected=status['connected'],
#                 tables_count=status['tables_count'],
#                 tables=status['tables'],
#                 message=message
#             )
#         else:
#             raise HTTPException(status_code=400, detail=message)
            
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Connection failed: {str(e)}")

# @app.get("/connection-status", response_model=ConnectionStatus)
# async def get_connection_status(agent: DatabaseAnalystAgent = Depends(get_agent)):
#     """Get current database connection status"""
#     try:
#         status = agent.get_connection_status()
#         return ConnectionStatus(
#             connected=status['connected'],
#             tables_count=status['tables_count'],
#             tables=status['tables'],
#             message="Connected" if status['connected'] else "Not connected"
#         )
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.get("/tables")
# async def get_table_info(agent: DatabaseAnalystAgent = Depends(get_agent)):
#     """Get information about database tables"""
#     try:
#         if not agent.get_connection_status()['connected']:
#             raise HTTPException(status_code=400, detail="No database connection")
        
#         return agent.get_table_info()
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/query", response_model=QueryResponse)
# async def execute_query(request: QueryRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
#     """Execute natural language query and save chat history"""
#     try:
#         if not agent.get_connection_status()['connected']:
#             raise HTTPException(status_code=400, detail="No database connection")
        
#         # Execute the query
#         result = agent.execute_natural_language_query(request.query)
        
#         # Convert DataFrame to list of dictionaries for JSON serialization
#         data_list = None
#         if result['data'] is not None:
#             data_list = result['data'].to_dict('records')
        
#         # Prepare visualization data (chart configuration for frontend)
#         visualization_data = None
#         if result['data'] is not None and not result['data'].empty:
#             # Create chart configuration data instead of plotly figure
#             visualization_data = prepare_visualization_data(result['data'], request.query)
        
#         # Prepare chat data for saving
#         chat_saved = False
#         if request.user_id and request.chat_id:  # Require both user_id and chat_id
#             chat_data = {
#                 "chatId": request.chat_id,
#                 "userId": request.user_id,
#                 "message": request.query,
#                 "response": result['response'],
#                 "sqlQuery": result.get('sql_query'),
#                 "data": data_list,
#                 "visualizationData": visualization_data,
#                 "timestamp": None  # Let NextJS set the timestamp
#             }
            
#             # Save chat to NextJS API (non-blocking for user experience)
#             try:
#                 chat_saved = await save_chat_to_nextjs(chat_data)
#             except Exception as save_error:
#                 print(f"Chat save error (non-critical): {save_error}")
#                 chat_saved = False
        
#         # Return response with chat save status
#         return QueryResponse(
#             success=result['success'],
#             response=result['response'],
#             sql_query=result['sql_query'],
#             data=data_list,
#             visualization_data=visualization_data,
#             error=None if result['success'] else result['response'],
#             chat_saved=chat_saved if (request.user_id and request.chat_id) else None
#         )
        
#     except Exception as e:
#         # Even if main query fails, try to save error to chat
#         chat_saved = False
#         if request.user_id and request.chat_id:
#             error_chat_data = {
#                 "chatId": request.chat_id,
#                 "userId": request.user_id,
#                 "message": request.query,
#                 "response": f"Query failed: {str(e)}",
#                 "sqlQuery": None,
#                 "data": None,
#                 "visualizationData": None
#             }
#             try:
#                 chat_saved = await save_chat_to_nextjs(error_chat_data)
#             except:
#                 pass
        
#         return QueryResponse(
#             success=False,
#             response="",
#             error=f"Query execution failed: {str(e)}",
#             chat_saved=chat_saved if (request.user_id and request.chat_id) else None
#         )

# def prepare_visualization_data(df: pd.DataFrame, query: str) -> Dict[str, Any]:
#     """Prepare chart data configuration for frontend"""
#     if df.empty or len(df.columns) < 2:
#         return None
    
#     query_lower = query.lower()
#     df_viz = df.head(20)  # Limit for visualization
    
#     # Determine chart type based on query
#     chart_type = "bar"  # default
    
#     if any(keyword in query_lower for keyword in ['trend', 'time', 'month', 'year', 'date']):
#         chart_type = "line"
#     elif any(keyword in query_lower for keyword in ['distribution', 'count', 'percentage']) and len(df_viz) <= 10:
#         chart_type = "pie"
#     elif any(keyword in query_lower for keyword in ['top', 'highest', 'best', 'most']):
#         chart_type = "bar"
    
#     # Prepare chart data
#     chart_data = {
#         'type': chart_type,
#         'data': df_viz.to_dict('records'),
#         'columns': list(df_viz.columns),
#         'x_axis': df_viz.columns[0],
#         'y_axis': df_viz.columns[1] if len(df_viz.columns) > 1 else df_viz.columns[0],
#         'title': f"Analysis: {query[:50]}{'...' if len(query) > 50 else ''}"
#     }
    
#     return chart_data

# @app.get("/suggestions")
# async def get_query_suggestions(partial_query: Optional[str] = "", agent: DatabaseAnalystAgent = Depends(get_agent)):
#     """Get query suggestions"""
#     try:
#         return {"suggestions": agent.get_query_suggestions(partial_query)}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# @app.post("/disconnect")
# async def disconnect_database(agent: DatabaseAnalystAgent = Depends(get_agent)):
#     """Disconnect from database"""
#     try:
#         agent.disconnect()
#         return {"message": "Disconnected successfully"}
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=str(e))

# # Updated test endpoint to include chat_id
# @app.post("/test-chat-save")
# async def test_chat_save(user_id: str = "test-user", chat_id: str = "test-chat-123"):
#     """Test endpoint to verify chat saving works"""
#     test_data = {
#         "chatId": chat_id,
#         "userId": user_id,
#         "message": "Test message from FastAPI",
#         "response": "This is a test response",
#         "sqlQuery": "SELECT * FROM test",
#         "data": [{"id": 1, "name": "test"}],
#         "visualizationData": None
#     }
    
#     saved = await save_chat_to_nextjs(test_data)
#     return {
#         "success": saved,
#         "message": "Chat save test completed",
#         "data_sent": test_data,
#         "url_used": f"{NEXTJS_API_URL}/chat/{chat_id}"
#     }

# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)



# Complete FastAPI main.py
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

# Add CORS middleware for NextJS frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # NextJS default port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
NEXTJS_API_URL = "http://localhost:3000/api"
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

@app.post("/query", response_model=QueryResponse)
async def execute_query(request: QueryRequest, agent: DatabaseAnalystAgent = Depends(get_agent)):
    """Execute natural language query - NextJS will handle saving"""
    try:
        if not agent.get_connection_status()['connected']:
            raise HTTPException(status_code=400, detail="No database connection")

        # Log the request for debugging
        print(f"🔍 Processing query for user: {request.user_id}, chat: {request.chat_id}")
        print(f"📝 Query: {request.query}")

        # Execute the query
        result = agent.execute_natural_language_query(request.query)

        # Convert DataFrame to list of dictionaries for JSON serialization
        data_list = None
        if result['data'] is not None:
            data_list = result['data'].to_dict('records')

        # Prepare visualization data (chart configuration for frontend)
        visualization_data = None
        if result['data'] is not None and not result['data'].empty:
            visualization_data = prepare_visualization_data(result['data'], request.query)

        print(f"✅ Query processed successfully: {result['success']}")

        # Return response - NextJS will handle saving
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
    
    
   