'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useEffect, useState } from 'react';
import { useDebounce } from "@uidotdev/usehooks";
import { signUpSchema } from '@/schemas/signUpSchema';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/components/ui/use-toast';
import axios, { AxiosError } from 'axios';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import * as z from 'zod';
import { signIn } from 'next-auth/react';

export default function SignUpForm() {
  const [username, setUsername] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameValid, setUsernameValid] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mounted, setMounted] = useState(false);

  const debouncedUsername = useDebounce(username, 500);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      username: '',
      email: '',
      password: '',
    },
  });

  useEffect(() => {
    const checkUsernameUnique = async () => {
      if (debouncedUsername && /^[a-zA-Z0-9_]{3,20}$/.test(debouncedUsername)) {
        setIsCheckingUsername(true);
        setUsernameValid(false);
        try {
          await axios.get(`/api/check-username-unique?username=${debouncedUsername}`);
          setUsernameValid(true);
        } catch (error) {
          const axiosError = error as AxiosError<{ message?: string }>;
          setUsernameValid(false);
          toast({
            title: 'Username Error',
            description: axiosError.response?.data?.message || 'Error checking username',
            variant: 'destructive',
          });
        } finally {
          setIsCheckingUsername(false);
        }
      }
    };
    checkUsernameUnique();
  }, [debouncedUsername, toast]);

  const onSubmit = async (data: z.infer<typeof signUpSchema>) => {
    setIsSubmitting(true);
    try {
      // 🔥 Step 1: Create user account
      const signUpResponse = await axios.post('/api/sign-up', {
        ...data,
        role: 'buyer', // ✅ Explicitly set user role
      });

      if (signUpResponse.data.success) {
        toast({
          title: 'Account Created',
          description: 'User account created successfully!',
        });

        // 🔥 Step 2: Add delay for database transaction
        await new Promise(resolve => setTimeout(resolve, 500));

        // 🔥 Step 3: Auto sign-in with userType parameter
        const result = await signIn('credentials', {
          redirect: false,
          identifier: data.email, // ✅ Use email as identifier
          password: data.password,
          userType: 'user', // ✅ Specify user type to only check UserModel
          callbackUrl: '/dashboard',
        });

        console.log('User sign-in response:', result); // 👈 Debug log

        if (result?.ok && !result?.error) {
          // ✅ Auto sign-in successful
          toast({
            title: 'Welcome!',
            description: 'Successfully signed in to your account.',
          });
          router.push('/dashboard');
        } else {
          // ❌ Auto sign-in failed
          console.error('Auto sign-in failed:', result?.error);
          
          toast({
            title: 'Account Created Successfully',
            description: `Auto sign-in failed: ${result?.error || 'Unknown error'}. Please sign in manually.`,
          });
          router.push('/sign-in');
        }
      }
    } catch (error) {
      const axiosError = error as AxiosError<{ error?: string }>;
      toast({
        title: 'Sign Up Failed',
        description: axiosError.response?.data?.error || 'Sign up failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#262624] flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-[#30302e] p-6 rounded-xl shadow-md">
        <div className='flex gap-3  items-center mb-6'>

       <Image src={Logo} alt="Logo" className="w-12 h-12 text-white" />
        <Image src={Logo_name} alt="Logo Name" className="w-24 h-9 " />

        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Username */}
            <FormField
              name="username"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Username</FormLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => {
                        field.onChange(e);
                        setUsername(e.target.value);
                      }}
                      placeholder="Enter username"
                      className="bg-zinc-800 text-white"
                    />
                    {debouncedUsername && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isCheckingUsername ? (
                          <Loader2 className="h-4 w-4 animate-spin text-[#ff9542]" />
                        ) : usernameValid ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-[#ff4866]" />
                        )}
                      </div>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              name="email"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Email</FormLabel>
                  <Input
                    {...field}
                    value={field.value ?? ''}
                    type="email"
                    placeholder="Enter email"
                    className="bg-zinc-800 text-white"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Password */}
            <FormField
              name="password"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white">Password</FormLabel>
                  <div className="relative">
                    <Input
                      {...field}
                      value={field.value ?? ''}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter password"
                      className="bg-zinc-800 text-white pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit */}
            <Button
              type="submit"
              className="w-full hover:bg-[#ff4866] bg-[#ff9542] text-white h-11"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="animate-spin h-4 w-4 mr-2" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </form>
        </Form>

        <p className="text-center text-zinc-400 mt-4">
          Already have an account?{' '}
          <Link href="/sign-in" className="text-[#ff9542] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}