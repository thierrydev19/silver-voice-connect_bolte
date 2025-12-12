import { PhoneFrame } from "@/components/PhoneFrame";
import { BigButton } from "@/components/BigButton";
import { TopBar } from "@/components/TopBar";
import { Heart, Users, Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Role = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const preselectedType = searchParams.get("type");
  const [isSettingRole, setIsSettingRole] = useState(false);

  // Check if user already has a role and redirect
  useEffect(() => {
    const checkExistingRole = async () => {
      if (!user) return;

      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleData?.role) {
        // User already has a role, redirect to appropriate dashboard
        navigate(roleData.role === 'senior' ? '/senior' : '/aidant');
      }
    };

    if (!authLoading && user) {
      checkExistingRole();
    }
  }, [user, authLoading, navigate]);

  // Handle preselected type from URL
  useEffect(() => {
    if (preselectedType && user && !authLoading) {
      handleRoleSelection(preselectedType as 'senior' | 'aidant');
    }
  }, [preselectedType, user, authLoading]);

  const handleRoleSelection = async (role: 'senior' | 'aidant') => {
    if (!user) {
      navigate(`/login?redirect=/role&type=${role}`);
      return;
    }

    setIsSettingRole(true);

    try {
      // Check if user already has a role
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingRole) {
        // User already has a role
        if (existingRole.role !== role) {
          toast.error(`Vous êtes déjà connecté en tant que ${existingRole.role === 'senior' ? 'Aîné' : 'Aidant'}. Déconnectez-vous pour changer de rôle.`);
          navigate(existingRole.role === 'senior' ? '/senior' : '/aidant');
          return;
        }
        navigate(role === 'senior' ? '/senior' : '/aidant');
        return;
      }

      // Create new role
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role });

      if (error) throw error;

      toast.success(`Bienvenue en tant que ${role === 'senior' ? 'Aîné' : 'Aidant'} !`);
      navigate(role === 'senior' ? '/senior' : '/aidant');
    } catch (error) {
      console.error('Error setting role:', error);
      toast.error('Erreur lors de la définition du rôle');
    } finally {
      setIsSettingRole(false);
    }
  };

  if (authLoading || isSettingRole) {
    return (
      <PhoneFrame>
        <TopBar title="Choisir mon rôle" onBack={() => navigate("/")} showUserInfo={false} />
        <div className="flex items-center justify-center min-h-[calc(100vh-73px)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Choisir mon rôle" onBack={() => navigate("/")} showUserInfo={false} />
      
      <div className="p-6 min-h-[calc(100vh-73px)] flex flex-col justify-center">
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-3">Comment puis-je vous aider ?</h2>
            <p className="text-muted-foreground text-lg">
              Choisissez votre rôle pour une expérience adaptée
            </p>
          </div>

          <div className="space-y-4">
            <BigButton
              variant="primary"
              icon={Heart}
              onClick={() => handleRoleSelection('senior')}
            >
              <span className="text-center">
                Je suis un aîné
                <span className="block text-sm opacity-90 font-normal mt-1">
                  Rappels vocaux et assistance
                </span>
              </span>
            </BigButton>

            <BigButton
              variant="secondary"
              icon={Users}
              onClick={() => handleRoleSelection('aidant')}
            >
              <span className="text-center">
                Je suis un aidant
                <span className="block text-sm opacity-90 font-normal mt-1">
                  Gestion et coordination
                </span>
              </span>
            </BigButton>
          </div>

          <p className="text-center text-sm text-muted-foreground px-4">
            Pour changer de rôle, vous devrez vous reconnecter
          </p>
        </div>
      </div>
    </PhoneFrame>
  );
};

export default Role;
