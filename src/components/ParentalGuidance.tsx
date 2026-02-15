import { useState } from 'react';
import { cn } from '@/lib/utils';
import { SeverityLevel } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { 
    AlertTriangle, 
    Skull, 
    MessageSquareWarning, 
    Wine, 
    Ghost,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface ParentalGuidanceData {
    nudity: SeverityLevel | null;
    violence: SeverityLevel | null;
    profanity: SeverityLevel | null;
    alcohol: SeverityLevel | null;
    frightening: SeverityLevel | null;
}

interface ParentalGuidanceProps {
    data: ParentalGuidanceData | null;
    isLoading?: boolean;
    className?: string;
}

// Severity level styles for Badges
const getSeverityBadgeStyle = (severity: SeverityLevel | null): string => {
    switch (severity) {
        case 'none':
            return 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20';
        case 'mild':
            return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20 hover:bg-yellow-500/20';
        case 'moderate':
            return 'bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20';
        case 'severe':
            return 'bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20';
        default:
            return 'bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10';
    }
};

interface CategoryItemProps {
    icon: React.ReactNode;
    label: string;
    severity: SeverityLevel | null;
    description?: string;
}

function CategoryItem({ icon, label, severity, description }: CategoryItemProps) {
    const severityLabel = severity ? severity.charAt(0).toUpperCase() + severity.slice(1) : 'Unknown';
    
    return (
        <div className="flex items-center gap-3 py-3 border-b border-white/5 last:border-0">
            <div className={cn(
                'flex items-center justify-center w-8 h-8 rounded-lg bg-white/5',
            )}>
                {icon}
            </div>
            <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground/90">{label}</span>
                <Badge variant="outline" className={cn("px-2 py-0 h-5 text-[10px] font-medium uppercase tracking-wider", getSeverityBadgeStyle(severity))}>
                    {severityLabel}
                </Badge>
            </div>
        </div>
    );
}

export function ParentalGuidance({ data, isLoading, className }: ParentalGuidanceProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (isLoading) {
        return (
            <div className={cn("space-y-4", className)}>
                <div className="h-7 w-48 bg-white/10 rounded mb-4 mx-auto md:mx-0" />
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-white/10 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-24 bg-white/10 rounded" />
                                <div className="h-1 bg-white/10 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (!data) {
        return null;
    }

    // Check if all values are null (no data available)
    const hasData = data.nudity || data.violence || data.profanity || data.alcohol || data.frightening;
    
    if (!hasData) {
        return null;
    }

    const categories = [
        { 
            icon: <AlertTriangle className="w-4 h-4 text-orange-400" />, 
            label: 'Sex & Nudity', 
            severity: data.nudity 
        },
        { 
            icon: <Skull className="w-4 h-4 text-red-400" />, 
            label: 'Violence & Gore', 
            severity: data.violence 
        },
        { 
            icon: <MessageSquareWarning className="w-4 h-4 text-yellow-400" />, 
            label: 'Profanity', 
            severity: data.profanity 
        },
        { 
            icon: <Wine className="w-4 h-4 text-purple-400" />, 
            label: 'Alcohol, Drugs & Smoking', 
            severity: data.alcohol 
        },
        { 
            icon: <Ghost className="w-4 h-4 text-blue-400" />, 
            label: 'Frightening & Intense Scenes', 
            severity: data.frightening 
        },
    ].filter(cat => cat.severity !== null);

    // Summary badges for collapsed view
    const getSeverityCounts = () => {
        const severities = [data.nudity, data.violence, data.profanity, data.alcohol, data.frightening]
            .filter(Boolean) as SeverityLevel[];
        
        const counts: Record<SeverityLevel, number> = {
            none: 0,
            mild: 0,
            moderate: 0,
            severe: 0
        };
        
        severities.forEach(s => counts[s]++);
        return counts;
    };

    const counts = getSeverityCounts();

    const severeCategories = categories.filter(c => c.severity === 'severe');
    const moderateCategories = categories.filter(c => c.severity === 'moderate');

    return (
        <div className={className}>
             <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                     <h2 className="text-xl md:text-2xl font-semibold text-foreground/90">
                        Parental Guidance
                    </h2>
                    <CollapsibleTrigger asChild>
                         <button className="flex items-center justify-center p-1 rounded-full hover:bg-white/10 text-muted-foreground hover:text-primary transition-colors">
                            {isOpen ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                        </button>
                    </CollapsibleTrigger>
                </div>

                {/* Summary Badges (Collapsed View Only) */}
                {!isOpen && (severeCategories.length > 0 || moderateCategories.length > 0) && (
                    <div className="flex flex-wrap justify-center md:justify-start gap-2 mb-4">
                        {severeCategories.map((cat, idx) => (
                            <Badge key={`severe-${idx}`} variant="outline" className="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20 px-2 py-1">
                                {cat.label}
                            </Badge>
                        ))}
                        {moderateCategories.map((cat, idx) => (
                            <Badge key={`mod-${idx}`} variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20 hover:bg-orange-500/20 px-2 py-1">
                                {cat.label}
                            </Badge>
                        ))}
                    </div>
                )}
                
                <CollapsibleContent>
                    <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        {categories.map((cat, index) => (
                            <CategoryItem
                                key={index}
                                icon={cat.icon}
                                label={cat.label}
                                severity={cat.severity}
                            />
                        ))}
                        
                        {/* Attribution */}
                        <div className="pt-3 mt-3 border-t border-white/10 flex justify-between items-center">
                            <p className="text-[10px] text-muted-foreground">
                                Severity ratings based on content analysis
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                                Source: IMDB
                            </p>
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </div>
    );
}

export default ParentalGuidance;
