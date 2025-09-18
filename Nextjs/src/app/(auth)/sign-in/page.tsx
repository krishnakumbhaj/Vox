'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { signInSchema } from '@/schemas/signInSchema';
import { z } from 'zod';
import Image from 'next/image';
import Logo_name from '@/app/images/Logo_name.png';
import Logo from '@/app/images/Logo.png';
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';

export default function SignInForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof signInSchema>>({
    resolver: zodResolver(signInSchema),
    defaultValues: {
      identifier: '',
      password: '',
    },
  });

  const onSubmit = async (data: z.infer<typeof signInSchema>) => {
    setIsSubmitting(true);

    // 🔥 FIX: Add userType parameter to ensure only users can sign in here
    const result = await signIn('credentials', {
      redirect: false,
      identifier: data.identifier,
      password: data.password,
      userType: 'user', // ✅ This restricts to UserModel only
      callbackUrl: '/dashboard', // ✅ User-specific callback
    });

    if (result?.error) {
      toast({
        title: 'Login Failed',
        description: result.error === 'CredentialsSignin'
          ? 'Incorrect username or password'
          : result.error,
        variant: 'destructive',
      });
      setIsSubmitting(false);
      return;
    }

    if (result?.ok) {
      toast({ 
        title: 'Welcome back!', 
        description: 'Successfully signed in' 
      });
      
      // 🔥 FIX: Redirect to user dashboard
      router.push('/dashboard'); // ✅ Changed from '/dashboard' to '/dashboard'
    }

    setIsSubmitting(false);
  };

  return (
    <div className="min-h-screen flex bg-[#262624] items-center justify-center  px-4">
      <div className="w-full max-w-md bg-[#30302e] border border-zinc-700 rounded-lg p-6 shadow-lg">
       <div className='flex gap-3  items-center mb-2'>
       
              <Image src={Logo} alt="Logo" className="w-12 h-12 text-white" />
               <Image src={Logo_name} alt="Logo Name" className="w-24 h-9 " />
       
               </div>
        <p className="text-center text-zinc-400  text-4xl mb-6">
          Sign In
        </p>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              name="identifier"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Email / Username</FormLabel>
                  <Input
                    {...field}
                    placeholder="Enter your email or username"
                    className="bg-zinc-800 text-white"
                  />
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <FormField
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Password</FormLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter your password"
                      className="bg-zinc-800 text-white pr-10"
                    />
                    <button
                      type="button"
                      className="absolute right-2 top-2.5 text-zinc-400"
                      onClick={() => setShowPassword((prev) => !prev)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <FormMessage className="text-red-400" />
                </FormItem>
              )}
            />

            <div className="text-right">
              <Link
                href="/forgot-password"
                className="text-sm text-[#ff9542] hover:underline"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#ff9542] hover:bg-[#ff4866] text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-zinc-400 mt-6 text-sm">
          Don&apos;t have an account?{' '}
          <Link href="/sign-up" className="text-[#ff9542] hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}