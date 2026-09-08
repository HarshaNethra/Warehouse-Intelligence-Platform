from fastapi import APIRouter
from app.schemas.assistant import ChatRequest, ChatResponse
from app.services import assistant_service

router = APIRouter(prefix="/assistant", tags=["Assistant"])

@router.post("/chat", response_model=ChatResponse)
async def chat_with_assistant(request: ChatRequest):
    return await assistant_service.handle_chat_query(request)
