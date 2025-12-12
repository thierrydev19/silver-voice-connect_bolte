import { ArrowLeft, Menu, LogOut, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TopBarProps {
  title: string;
  onBack?: () => void;
  onMenu?: () => void;
  showUserInfo?: boolean;
}

export const TopBar = ({ title, onBack, onMenu, showUserInfo = true }: TopBarProps) => {
  const { firstName, role } = useUserProfile();
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const roleLabel = role === 'senior' ? 'Aîné' : role === 'aidant' ? 'Aidant' : null;

  return (
    <div className="flex items-center justify-between p-4 bg-card border-b border-border">
      {onBack ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="rounded-full"
        >
          <ArrowLeft className="w-6 h-6" />
        </Button>
      ) : (
        <div className="w-10" />
      )}
      
      <h1 className="text-xl font-bold text-center flex-1">{title}</h1>
      
      {showUserInfo && user && firstName ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full gap-2 text-sm font-medium"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                <span className="text-sm font-semibold text-primary">
                  {firstName[0]}
                </span>
              </div>
              <span className="hidden sm:inline">{firstName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <div className="px-2 py-1.5 text-sm font-medium">
              {firstName}
              {roleLabel && (
                <span className="ml-2 text-xs text-muted-foreground">({roleLabel})</span>
              )}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="w-4 h-4 mr-2" />
              Paramètres
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="w-4 h-4 mr-2" />
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : onMenu ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenu}
          className="rounded-full"
        >
          <Menu className="w-6 h-6" />
        </Button>
      ) : (
        <div className="w-10" />
      )}
    </div>
  );
};
