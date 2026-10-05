import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] font-medium transition-colors disabled:pointer-events-none disabled:opacity-55 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-ledger text-white hover:bg-ledger-hover',
        secondary: 'border border-rule-strong bg-sheet text-ink hover:bg-bar',
        ghost: 'text-ink-2 hover:bg-bar hover:text-ink',
        danger: 'bg-stamp text-white hover:brightness-90',
        'danger-secondary': 'border border-stamp/40 bg-sheet text-stamp hover:bg-stamp-wash',
      },
      size: {
        sm: 'h-7 px-2.5 text-[0.8125rem]',
        md: 'h-8 px-3 text-[0.875rem]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, type = 'button', ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} {...props} />
));
Button.displayName = 'Button';

export { buttonVariants };
