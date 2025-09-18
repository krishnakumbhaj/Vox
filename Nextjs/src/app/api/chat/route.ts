// app/api/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import ChatModel from '@/models/Chat';
import UserModel from '@/models/User';
import { Types } from 'mongoose';

// GET: Fetch all chats for authenticated user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get user by email to get ObjectId
    const user = await UserModel.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Fetch user's chats, sorted by most recent
    const chats = await ChatModel.find({ 
      userId: user._id, 
      isActive: true 
    })
    .select('_id title createdAt updatedAt messages')
    .sort({ updatedAt: -1 })
    .limit(50);

    // Format response with message preview
    const formattedChats = chats.map(chat => ({
      id: chat._id.toString(),
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt,
      messageCount: chat.messages.length,
      lastMessage: chat.messages.length > 0 ? 
        chat.messages[chat.messages.length - 1].content.substring(0, 100) : null
    }));

    return NextResponse.json({
      success: true,
      chats: formattedChats
    });

  } catch (error) {
    console.error('Error fetching chats:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch chats', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// POST: Create new chat
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, firstMessage } = await request.json();

    await dbConnect();

    // Get user by email to get ObjectId
    const user = await UserModel.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Create new chat
    const newChat = new ChatModel({
      userId: user._id,
      title: title || 'New Database Query',
      messages: firstMessage ? [{
        id: new Types.ObjectId().toString(),
        role: 'user',
        content: firstMessage,
        timestamp: new Date()
      }] : []
    });

    await newChat.save();

    return NextResponse.json({
      success: true,
      chat: {
        id: newChat._id.toString(),
        title: newChat.title,
        createdAt: newChat.createdAt,
        updatedAt: newChat.updatedAt,
        messages: newChat.messages
      }
    });

  } catch (error) {
    console.error('Error creating chat:', error);
    return NextResponse.json({ 
      error: 'Failed to create chat', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// DELETE: Delete all chats for user (clear history)
export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    // Get user by email to get ObjectId
    const user = await UserModel.findOne({ email: session.user.email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete all chats
    await ChatModel.updateMany(
      { userId: user._id },
      { isActive: false }
    );

    return NextResponse.json({
      success: true,
      message: 'All chats cleared'
    });

  } catch (error) {
    console.error('Error clearing chats:', error);
    return NextResponse.json({ 
      error: 'Failed to clear chats', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}