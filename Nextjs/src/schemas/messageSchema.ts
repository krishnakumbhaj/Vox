import { z } from 'zod';

export const messageSchema = z.object({
            content: z
                        .string()
                        .min(10, 'Message content must not be empty')
                        .max(300, 'Message content must not exceed 300 characters'),
}); 