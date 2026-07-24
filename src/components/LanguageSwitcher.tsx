import { Globe } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '@/i18n/config';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface LanguageSwitcherProps {
  variant?: 'default' | 'sidebar' | 'ghost';
  className?: string;
}

export function LanguageSwitcher({ variant = 'default', className }: LanguageSwitcherProps) {
  const { t, i18n } = useTranslation();
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === i18n.language?.split('-')[0])
    ?? SUPPORTED_LANGUAGES[0];

  const setLanguage = (code: SupportedLanguage) => {
    void i18n.changeLanguage(code);
  };

  const triggerClass = cn(
    variant === 'sidebar' &&
      'w-full justify-start gap-2 px-2 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
    variant === 'ghost' && 'gap-2',
    className,
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant === 'sidebar' ? 'ghost' : variant === 'ghost' ? 'ghost' : 'outline'}
          size="sm"
          className={triggerClass}
        >
          <Globe className="h-4 w-4 shrink-0" />
          <span className={cn(variant === 'sidebar' && 'group-data-[collapsible=icon]:hidden', 'text-xs sm:text-sm')}>
            {current.nativeLabel}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[180px]">
        <DropdownMenuLabel>{t('common.selectLanguage')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code)}
            className={cn(i18n.language?.startsWith(lang.code) && 'bg-muted font-medium')}
          >
            <span className="flex-1">{lang.nativeLabel}</span>
            <span className="text-xs text-muted-foreground">{lang.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
