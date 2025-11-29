import { Check, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export type FlowStep = {
  step: number;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  details?: string;
};

interface PaymentFlowVisualizerProps {
  steps: FlowStep[];
  className?: string;
}

export const PaymentFlowVisualizer = ({ steps, className }: PaymentFlowVisualizerProps) => {
  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between gap-4">
        {steps.map((step, index) => (
          <div key={step.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              {/* Step Circle */}
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300',
                  step.status === 'pending' && 'bg-muted text-muted-foreground',
                  step.status === 'processing' && 'bg-primary/20 text-primary animate-pulse',
                  step.status === 'completed' && 'bg-primary text-primary-foreground',
                  step.status === 'error' && 'bg-destructive text-destructive-foreground'
                )}
              >
                {step.status === 'pending' && (
                  <span className="text-sm font-medium">{step.step}</span>
                )}
                {step.status === 'processing' && (
                  <Loader2 className="w-5 h-5 animate-spin" />
                )}
                {step.status === 'completed' && (
                  <Check className="w-5 h-5" />
                )}
                {step.status === 'error' && (
                  <X className="w-5 h-5" />
                )}
              </div>

              {/* Step Label */}
              <div className="mt-2 text-center">
                <p
                  className={cn(
                    'text-xs font-medium transition-colors',
                    step.status === 'pending' && 'text-muted-foreground',
                    step.status === 'processing' && 'text-primary',
                    step.status === 'completed' && 'text-primary',
                    step.status === 'error' && 'text-destructive'
                  )}
                >
                  {step.name}
                </p>
                {step.details && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {step.details}
                  </p>
                )}
              </div>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 -mx-2 mb-6">
                <div
                  className={cn(
                    'h-full transition-all duration-500',
                    step.status === 'completed' ? 'bg-primary' : 'bg-muted'
                  )}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
