import { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  className?: string;
}

export const PhoneFrame = ({ children, className = "" }: PhoneFrameProps) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 flex items-center justify-center p-4">
      <div className={`w-full max-w-md bg-card rounded-3xl shadow-2xl overflow-hidden ${className}`}>
        {children}
      </div>
    </div>
  );
};
