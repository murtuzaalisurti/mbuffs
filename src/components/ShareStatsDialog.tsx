import { useEffect, useState } from 'react';
import { Download, Loader2, Share2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { renderStatsShareCard, shareCardFileName, type ShareCardFormat } from '@/lib/statsShareCard';
import type { UserStatsResponse } from '@/lib/types';

interface ShareStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stats: UserStatsResponse;
  tasteSummary: string | null;
}

type RenderedCard = { format: ShareCardFormat; blob: Blob; url: string } | { format: ShareCardFormat; error: true };

const FORMATS: Array<{ value: ShareCardFormat; label: string }> = [
  { value: 'story', label: 'Story' },
  { value: 'square', label: 'Square' },
];

export function ShareStatsDialog({ open, onOpenChange, stats, tasteSummary }: ShareStatsDialogProps) {
  const { toast } = useToast();
  const [format, setFormat] = useState<ShareCardFormat>('story');
  const [card, setCard] = useState<RenderedCard | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    renderStatsShareCard(stats, format, { tasteSummary })
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setCard({ format, blob, url });
      })
      .catch((error) => {
        console.error('[share-card] render failed:', error);
        if (!cancelled) setCard({ format, error: true });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, format, stats, tasteSummary]);

  // Only the card for the selected format counts; anything else is stale
  const current = card?.format === format ? card : null;
  const ready = current && !('error' in current) ? current : null;
  const file = ready ? new File([ready.blob], shareCardFileName(stats, format), { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const download = () => {
    if (!ready || !file) return;
    const link = document.createElement('a');
    link.href = ready.url;
    link.download = file.name;
    link.click();
  };

  const share = async () => {
    if (!file) return;
    try {
      await navigator.share({ files: [file], title: stats.year === null ? 'My life in film' : `My ${stats.year} in film` });
    } catch (error) {
      // Closing the share sheet is not an error worth reporting
      if (error instanceof DOMException && error.name === 'AbortError') return;
      toast({ title: "Couldn't share", description: 'Try downloading the image instead.', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share your stats</DialogTitle>
          <DialogDescription>An image of your recap. Nothing is posted until you share it.</DialogDescription>
        </DialogHeader>

        <div role="group" aria-label="Image size" className="flex gap-2">
          {FORMATS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={format === option.value}
              onClick={() => setFormat(option.value)}
              className={cn(
                'rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-(--dur-fast)',
                format === option.value
                  ? 'bg-foreground text-background'
                  : 'border border-white/10 text-muted-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div
          className={cn(
            'mx-auto flex w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02]',
            format === 'story' ? 'aspect-[9/16] max-h-[52vh] max-w-[calc(52vh*9/16)]' : 'aspect-square max-h-[52vh] max-w-[52vh]'
          )}
        >
          {ready ? (
            <img src={ready.url} alt="Preview of your stats image" className="h-full w-full object-contain" />
          ) : current ? (
            <p className="px-6 text-center text-sm text-muted-foreground">Couldn't create the image. Try again in a moment.</p>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Creating image" />
          )}
        </div>

        <div className="flex gap-2">
          {canShareFile && (
            <Button className="flex-1" onClick={share}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          )}
          <Button className="flex-1" variant={canShareFile ? 'outline' : 'default'} onClick={download} disabled={!ready}>
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
