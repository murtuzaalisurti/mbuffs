import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CertificationBadgeProps {
    certification: string | null | undefined;
    className?: string;
}

// Certification color mapping based on rating severity
const getCertificationColor = (cert: string): string => {
    const upperCert = cert.toUpperCase();
    
    // Movie ratings (MPAA)
    if (['G', 'TV-G', 'TV-Y', 'TV-Y7'].includes(upperCert)) {
        return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
    if (['PG', 'TV-PG'].includes(upperCert)) {
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    }
    if (['PG-13', 'TV-14'].includes(upperCert)) {
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
    if (['R', 'TV-MA', 'NC-17', 'X', '18', '18+', 'A'].includes(upperCert)) {
        return 'bg-red-500/20 text-red-400 border-red-500/30';
    }
    
    // International ratings
    if (['U', 'PG', '12', '12A', '15'].includes(upperCert)) {
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    }
    
    // Default
    return 'bg-white/10 text-white/80 border-white/20';
};

export function CertificationBadge({ certification, className }: CertificationBadgeProps) {
    if (!certification) {
        return null;
    }

    const colorClass = getCertificationColor(certification);

    return (
        <Badge 
            variant="outline" 
            className={cn(
                'font-bold text-xs px-2 py-0.5 h-5',
                colorClass,
                className
            )}
        >
            {certification}
        </Badge>
    );
}

export default CertificationBadge;
