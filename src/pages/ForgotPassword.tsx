import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { ArrowLeft, Loader2, MailCheck } from 'lucide-react';
import { requestPasswordReset } from '@/lib/auth-client';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || '';

const forgotPasswordSchema = z.object({
    email: z.email('Please enter a valid email address'),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

const ForgotPassword = () => {
    const location = useLocation();
    const prefillEmail = (location.state as { email?: string } | null)?.email ?? '';
    const [captchaToken, setCaptchaToken] = useState<string | null>(null);
    // Bumping the key remounts the widget, which resets it (tokens are single-use).
    const [captchaKey, setCaptchaKey] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [sentTo, setSentTo] = useState<string | null>(null);

    const form = useForm<ForgotPasswordValues>({
        resolver: zodResolver(forgotPasswordSchema),
        defaultValues: { email: prefillEmail },
    });

    const resetCaptcha = () => {
        setCaptchaToken(null);
        setCaptchaKey((key) => key + 1);
    };

    const onSubmit = async ({ email }: ForgotPasswordValues) => {
        if (TURNSTILE_SITE_KEY && !captchaToken) {
            setFormError('Please complete the captcha verification.');
            return;
        }

        setIsSubmitting(true);
        setFormError(null);

        try {
            const result = await requestPasswordReset({
                email,
                redirectTo: `${window.location.origin}/reset-password`,
                fetchOptions: captchaToken ? { headers: { 'x-captcha-response': captchaToken } } : undefined,
            });

            if (result.error) {
                setFormError(
                    result.error.status === 429
                        ? 'Too many requests. Please wait a minute and try again.'
                        : result.error.message || 'Could not send the reset link. Please try again.'
                );
                resetCaptcha();
                return;
            }

            // Same response whether or not the email has an account.
            setSentTo(email);
        } catch {
            setFormError('Something went wrong. Please try again.');
            resetCaptcha();
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="flex items-center justify-center px-4 py-12 sm:py-20">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <div className="flex items-center justify-start">
                            <Button variant="ghost" size="sm" asChild>
                                <Link to="/login">
                                    <ArrowLeft className="h-4 w-4" />
                                    Back to sign in
                                </Link>
                            </Button>
                        </div>
                        <CardTitle className="text-2xl font-bold">Reset your password</CardTitle>
                        <CardDescription>
                            {sentTo
                                ? 'Check your inbox for the reset link.'
                                : "Enter your account's email and we'll send you a link to choose a new password."}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {sentTo ? (
                            <div className="space-y-4 text-center">
                                <MailCheck className="h-10 w-10 mx-auto text-primary" />
                                <p className="text-sm text-muted-foreground">
                                    If an account exists for <span className="font-medium text-foreground break-all">{sentTo}</span>, a reset link is on its way. It expires in 1 hour. Check your spam folder if you don't see it.
                                </p>
                                <Button
                                    variant="outline"
                                    className="w-full"
                                    onClick={() => {
                                        setSentTo(null);
                                        resetCaptcha();
                                    }}
                                >
                                    Use a different email
                                </Button>
                            </div>
                        ) : (
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <FormField
                                        control={form.control}
                                        name="email"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Email</FormLabel>
                                                <FormControl>
                                                    <Input type="email" placeholder="you@example.com" autoComplete="email" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    {TURNSTILE_SITE_KEY && (
                                        <Turnstile
                                            key={captchaKey}
                                            siteKey={TURNSTILE_SITE_KEY}
                                            onSuccess={(token) => setCaptchaToken(token)}
                                            onExpire={() => setCaptchaToken(null)}
                                            options={{ theme: 'dark', size: 'flexible' }}
                                        />
                                    )}

                                    {formError && <p className="text-sm text-destructive">{formError}</p>}

                                    <Button type="submit" className="w-full" disabled={isSubmitting}>
                                        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send reset link'}
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

export default ForgotPassword;
