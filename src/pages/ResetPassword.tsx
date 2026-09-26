import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheck, Loader2 } from 'lucide-react';
import { resetPassword, signOut } from '@/lib/auth-client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

// Matches Better Auth's default password limits.
const resetPasswordSchema = z.object({
    password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string().min(8, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
});

type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;

// The emailed link hits the backend first, which redirects here with either
// ?token=... (valid) or ?error=INVALID_TOKEN (expired or already used).
const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [isLinkInvalid, setIsLinkInvalid] = useState(() => !token || searchParams.has('error'));
    const [isDone, setIsDone] = useState(false);

    const form = useForm<ResetPasswordValues>({
        resolver: zodResolver(resetPasswordSchema),
        defaultValues: { password: '', confirmPassword: '' },
    });

    const onSubmit = async ({ password }: ResetPasswordValues) => {
        if (!token) return;

        setIsSubmitting(true);
        setFormError(null);

        try {
            const result = await resetPassword({ newPassword: password, token });

            if (result.error) {
                if (result.error.code === 'INVALID_TOKEN') {
                    setIsLinkInvalid(true);
                } else {
                    setFormError(result.error.message || 'Could not reset your password. Please try again.');
                }
                return;
            }

            // The reset revoked every session server-side, but this browser still
            // holds the session cookies (trusted for up to 5 minutes by the
            // cookie cache) and the in-memory session. Sign out to clear both;
            // otherwise /login sees a signed-in user and bounces to home.
            await signOut().catch(() => { /* cookies are best-effort; the session is already revoked */ });

            setIsDone(true);
        } catch {
            setFormError('Something went wrong. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const title = isDone ? 'Password updated' : isLinkInvalid ? 'Link expired' : 'Choose a new password';
    const description = isDone
        ? "You've been signed out on every device. Sign in with your new password."
        : isLinkInvalid
            ? 'This reset link is invalid, expired, or has already been used.'
            : 'Pick a password with at least 8 characters.';

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="flex items-center justify-center px-4 py-12 sm:py-20">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl font-bold">{title}</CardTitle>
                        <CardDescription>{description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {isDone ? (
                            <div className="space-y-4 text-center">
                                <CircleCheck className="h-10 w-10 mx-auto text-primary" />
                                <Button asChild className="w-full">
                                    <Link to="/login">Go to sign in</Link>
                                </Button>
                            </div>
                        ) : isLinkInvalid ? (
                            <Button asChild className="w-full">
                                <Link to="/forgot-password">Send a new link</Link>
                            </Button>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="password"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>New password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" autoComplete="new-password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="confirmPassword"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Confirm new password</FormLabel>
                                                <FormControl>
                                                    <Input type="password" autoComplete="new-password" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update password'}
                                    </Button>
                                </form>
                            </Form>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ResetPassword;
