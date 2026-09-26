import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod/v4';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { ChevronDown, KeyRound, Loader2, MailCheck } from 'lucide-react';
import { changePassword, listAccounts, sendVerificationEmail } from '@/lib/auth-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';

const ACCOUNTS_QUERY_KEY = ['user', 'accounts'];

// Matches Better Auth's default password limits.
const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password must be at most 128 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
}).refine((data) => data.newPassword !== data.currentPassword, {
    message: 'Choose a password different from your current one',
    path: ['newPassword'],
});

type ChangePasswordValues = z.infer<typeof changePasswordSchema>;

interface SecuritySettingsProps {
    email: string;
    emailVerified: boolean;
}

export const SecuritySettings = ({ email, emailVerified }: SecuritySettingsProps) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [isSendingVerification, setIsSendingVerification] = useState(false);
    const [verificationSent, setVerificationSent] = useState(false);
    const [signOutOtherDevices, setSignOutOtherDevices] = useState(true);
    const [isOpen, setIsOpen] = useState(false);

    const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
        queryKey: ACCOUNTS_QUERY_KEY,
        queryFn: async () => {
            const result = await listAccounts();
            if (result.error) throw new Error(result.error.message || 'Failed to load sign-in methods');
            return result.data;
        },
    });
    const hasPassword = accounts?.some((account) => account.providerId === 'credential') ?? false;

    const form = useForm<ChangePasswordValues>({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
    });

    // The verification link returns here with ?verified=1, plus ?error=... when
    // the token was expired or invalid.
    useEffect(() => {
        if (!searchParams.has('verified')) return;

        const error = searchParams.get('error');
        if (error) {
            toast.error(error === 'TOKEN_EXPIRED'
                ? 'That verification link has expired. Send a new one below.'
                : 'That verification link is invalid. Send a new one below.');
        } else {
            toast.success('Email verified.');
        }

        setSearchParams((params) => {
            params.delete('verified');
            params.delete('error');
            return params;
        }, { replace: true });
    }, [searchParams, setSearchParams]);

    const handleSendVerification = async () => {
        setIsSendingVerification(true);
        try {
            const result = await sendVerificationEmail({
                email,
                callbackURL: `${window.location.origin}/profile?verified=1`,
            });
            if (result.error) {
                toast.error(result.error.status === 429
                    ? 'Too many requests. Please wait a minute and try again.'
                    : result.error.message || 'Could not send the verification email.');
                return;
            }
            setVerificationSent(true);
            toast.success(`Verification link sent to ${email}.`);
        } catch {
            toast.error('Could not send the verification email.');
        } finally {
            setIsSendingVerification(false);
        }
    };

    const onChangePassword = async ({ currentPassword, newPassword }: ChangePasswordValues) => {
        try {
            const result = await changePassword({
                currentPassword,
                newPassword,
                revokeOtherSessions: signOutOtherDevices,
            });

            if (result.error) {
                if (result.error.code === 'INVALID_PASSWORD') {
                    form.setError('currentPassword', { message: 'Current password is incorrect' });
                } else {
                    toast.error(result.error.status === 429
                        ? 'Too many attempts. Please wait a few seconds and try again.'
                        : result.error.message || 'Could not change your password.');
                }
                return;
            }

            form.reset();
            toast.success(signOutOtherDevices
                ? 'Password changed. Other devices have been signed out.'
                : 'Password changed.');
        } catch {
            toast.error('Could not change your password.');
        }
    };

    return (
        <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
            <Card className="mt-6">
                <CardHeader>
                    <CollapsibleTrigger className="flex w-full items-start justify-between gap-4 text-left rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
                        <div className="space-y-1.5">
                            <CardTitle className="flex items-center gap-2">
                                <KeyRound className="h-5 w-5" />
                                Sign-in &amp; Security
                                {!emailVerified && !isOpen && (
                                    <Badge variant="outline" className="font-normal">Email unverified</Badge>
                                )}
                            </CardTitle>
                            <CardDescription>
                                Manage your email verification and password.
                            </CardDescription>
                        </div>
                        <ChevronDown
                            className={`h-5 w-5 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                            aria-hidden="true"
                        />
                    </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                    <CardContent className="space-y-6">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-0.5 min-w-0">
                                <p className="text-base font-medium flex items-center gap-2">
                                    Email
                                    <Badge variant={emailVerified ? 'secondary' : 'outline'}>
                                        {emailVerified ? 'Verified' : 'Unverified'}
                                    </Badge>
                                </p>
                                <p className="text-sm text-muted-foreground break-all">{email}</p>
                                {!emailVerified && (
                                    <p className="text-xs text-muted-foreground">
                                        Verifying lets you also sign in with Google using this email.
                                    </p>
                                )}
                            </div>
                            {!emailVerified && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleSendVerification}
                                    disabled={isSendingVerification}
                                    className="shrink-0"
                                >
                                    {isSendingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
                                    {verificationSent ? 'Resend verification email' : 'Verify my email'}
                                </Button>
                            )}
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="space-y-0.5">
                                <p className="text-base font-medium">Password</p>
                                {!isLoadingAccounts && !hasPassword && (
                                    <p className="text-sm text-muted-foreground">
                                        You sign in with Google, so there's no password on this account. To add one, request a reset link for {email} and choose a password.
                                    </p>
                                )}
                            </div>

                            {isLoadingAccounts ? (
                                <Skeleton className="h-10 w-full" />
                            ) : hasPassword ? (
                                <Form {...form}>
                                    <form onSubmit={form.handleSubmit(onChangePassword)} className="space-y-4">
                                        <FormField
                                            control={form.control}
                                            name="currentPassword"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Current password</FormLabel>
                                                    <FormControl>
                                                        <Input type="password" autoComplete="current-password" {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="newPassword"
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
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                id="sign-out-other-devices"
                                                checked={signOutOtherDevices}
                                                onCheckedChange={(checked) => setSignOutOtherDevices(checked === true)}
                                            />
                                            <Label htmlFor="sign-out-other-devices" className="text-sm font-normal">
                                                Sign out of other devices
                                            </Label>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <Button type="submit" disabled={form.formState.isSubmitting}>
                                                {form.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                                                Change password
                                            </Button>
                                            <Button variant="ghost" asChild>
                                                <Link to="/forgot-password" state={{ email }}>Forgot your password?</Link>
                                            </Button>
                                        </div>
                                    </form>
                                </Form>
                            ) : (
                                <Button variant="outline" asChild>
                                    <Link to="/forgot-password" state={{ email }}>Add a password</Link>
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </CollapsibleContent>
            </Card>
        </Collapsible>
    );
};
