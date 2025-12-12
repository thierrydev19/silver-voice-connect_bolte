import { Button } from "@/components/ui/button";
import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface BigButtonProps {
  children: ReactNode;
  onClick?: () => void;
  icon?: LucideIcon;
  variant?: "primary" | "secondary" | "accent";
  className?: string;
  disabled?: boolean;
}

export const BigButton = ({ 
  children, 
  onClick, 
  icon: Icon, 
  variant = "primary",
  className = "",
  disabled = false
}: BigButtonProps) => {
  const variantStyles = {
    primary: "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg hover:shadow-xl active:scale-[0.98]",
    secondary: "bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-md hover:shadow-lg active:scale-[0.98]",
    accent: "bg-accent hover:bg-accent/90 text-accent-foreground shadow-md hover:shadow-lg active:scale-[0.98]"
  };

  return (
    <Button
      onClick={onClick}
      disabled={disabled}
      className={`
        w-full h-auto 
        min-h-[80px] sm:min-h-[90px] md:min-h-[100px]
        py-5 sm:py-6 md:py-8 
        px-6 sm:px-8 md:px-10 
        text-xl sm:text-2xl md:text-2xl 
        font-semibold 
        rounded-2xl sm:rounded-3xl
        transition-all duration-200 
        touch-manipulation
        ${variantStyles[variant]} 
        ${className}
      `}
    >
      <div className="flex flex-col items-center gap-2 sm:gap-3 w-full">
        {Icon && <Icon className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14" strokeWidth={1.5} />}
        <span className="leading-tight">{children}</span>
      </div>
    </Button>
  );
};
