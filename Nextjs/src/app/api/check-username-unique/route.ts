import dbConnect from '@/lib/dbConnect';
import UserModel from '@/models/User';
import { z } from 'zod';
import { usernameValidation } from '@/schemas/signUpSchema';

export const dynamic = 'force-dynamic';

const UsernameQuerySchema = z.object({
  username: usernameValidation,
});

export async function GET(request: Request) {
  try {
    await dbConnect();

    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');

    if (!username) {
      return Response.json(
        {
          success: false,
          message: 'Username parameter is required',
        },
        { status: 400 }
      );
    }

    const result = UsernameQuerySchema.safeParse({ username });

    if (!result.success) {
      const usernameErrors = result.error.format().username?._errors || [];
      return Response.json(
        {
          success: false,
          message:
            usernameErrors.length > 0
              ? usernameErrors.join(', ')
              : 'Invalid query parameters',
        },
        { status: 400 }
      );
    }

    const existingUser = await UserModel.findOne({ 
      username: result.data.username 
    });

    if (existingUser) {
      return Response.json(
        {
          success: false,
          message: 'Username is already taken',
        },
        { status: 409 }
      );
    }

    return Response.json(
      {
        success: true,
        message: 'Username is unique',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error checking username:', error);
    return Response.json(
      {
        success: false,
        message: 'Error checking username',
      },
      { status: 500 }
    );
  }
}