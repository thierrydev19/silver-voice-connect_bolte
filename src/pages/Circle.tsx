import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { BigButton } from "@/components/BigButton";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Plus, Copy, UserPlus, Check, Loader2, LogOut, Crown, Settings } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Circle {
  id: string;
  name: string;
  invitation_code: string | null;
  created_by: string;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  display_name: string | null;
}

const Circle = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [circleName, setCircleName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [copied, setCopied] = useState(false);

  // Récupérer le cercle de l'utilisateur
  useEffect(() => {
    const fetchCircle = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Récupérer l'adhésion au cercle
      const { data: membership } = await supabase
        .from('circle_members')
        .select('circle_id, role')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (membership) {
        // Récupérer les détails du cercle
        const { data: circleData } = await supabase
          .from('circles')
          .select('*')
          .eq('id', membership.circle_id)
          .single();

        if (circleData) {
          setCircle(circleData);
          
          // Récupérer les membres
          const { data: membersData } = await supabase
            .from('circle_members')
            .select('id, user_id, role')
            .eq('circle_id', circleData.id);

          if (membersData) {
            // Récupérer les profils des membres
            const userIds = membersData.map(m => m.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('user_id, display_name')
              .in('user_id', userIds);

            const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
            
            const membersWithNames = membersData.map(m => ({
              ...m,
              display_name: profileMap.get(m.user_id) || 'Membre'
            }));
            
            setMembers(membersWithNames);
          }
        }
      }
      
      setLoading(false);
    };

    fetchCircle();
  }, [user]);

  const handleCreateCircle = async () => {
    if (!user || !circleName.trim()) {
      toast.error("Veuillez entrer un nom pour le cercle");
      return;
    }

    setCreating(true);

    try {
      // Créer le cercle
      const { data: newCircle, error: circleError } = await supabase
        .from('circles')
        .insert({
          name: circleName.trim(),
          created_by: user.id
        })
        .select()
        .single();

      if (circleError) throw circleError;

      // Ajouter le créateur comme membre
      const { error: memberError } = await supabase
        .from('circle_members')
        .insert({
          circle_id: newCircle.id,
          user_id: user.id,
          role: 'senior'
        });

      if (memberError) throw memberError;

      setCircle(newCircle);
      setMembers([{
        id: crypto.randomUUID(),
        user_id: user.id,
        role: 'senior',
        display_name: 'Vous'
      }]);
      
      setShowCreateForm(false);
      setCircleName("");
      toast.success("Cercle créé avec succès !");
    } catch (err) {
      console.error('Erreur création:', err);
      toast.error("Erreur lors de la création du cercle");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinCircle = async () => {
    if (!user || !inviteCode.trim()) {
      toast.error("Veuillez entrer un code d'invitation");
      return;
    }

    setJoining(true);

    try {
      // Trouver le cercle avec ce code
      const { data: targetCircle, error: findError } = await supabase
        .from('circles')
        .select('*')
        .eq('invitation_code', inviteCode.trim().toUpperCase())
        .maybeSingle();

      if (findError) throw findError;
      
      if (!targetCircle) {
        toast.error("Code d'invitation invalide");
        setJoining(false);
        return;
      }

      // Vérifier si l'utilisateur n'est pas déjà membre
      const { data: existingMember } = await supabase
        .from('circle_members')
        .select('id')
        .eq('circle_id', targetCircle.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        toast.error("Vous êtes déjà membre de ce cercle");
        setJoining(false);
        return;
      }

      // Rejoindre le cercle
      const { error: joinError } = await supabase
        .from('circle_members')
        .insert({
          circle_id: targetCircle.id,
          user_id: user.id,
          role: 'aidant'
        });

      if (joinError) throw joinError;

      // Recharger la page pour afficher le cercle
      window.location.reload();
    } catch (err) {
      console.error('Erreur rejoindre:', err);
      toast.error("Erreur lors de la connexion au cercle");
    } finally {
      setJoining(false);
    }
  };

  const handleCopyCode = async () => {
    if (!circle?.invitation_code) return;
    
    try {
      await navigator.clipboard.writeText(circle.invitation_code);
      setCopied(true);
      toast.success("Code copié !");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier le code");
    }
  };

  const handleLeaveCircle = async () => {
    if (!user || !circle) return;

    // Ne pas permettre au créateur de quitter
    if (circle.created_by === user.id) {
      toast.error("Le créateur ne peut pas quitter le cercle");
      return;
    }

    try {
      const { error } = await supabase
        .from('circle_members')
        .delete()
        .eq('circle_id', circle.id)
        .eq('user_id', user.id);

      if (error) throw error;

      setCircle(null);
      setMembers([]);
      toast.success("Vous avez quitté le cercle");
    } catch (err) {
      console.error('Erreur:', err);
      toast.error("Erreur lors de la sortie du cercle");
    }
  };

  if (loading) {
    return (
      <PhoneFrame>
        <TopBar title="Mon cercle" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  if (!user) {
    return (
      <PhoneFrame>
        <TopBar title="Mon cercle" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Users className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
          <p className="text-muted-foreground mb-4">
            Connectez-vous pour gérer votre cercle familial.
          </p>
          <Button onClick={() => navigate('/login')}>Se connecter</Button>
        </div>
      </PhoneFrame>
    );
  }

  // Afficher le cercle existant
  if (circle) {
    const isCreator = circle.created_by === user.id;

    return (
      <PhoneFrame>
        <TopBar title="Mon cercle" onBack={() => navigate(-1)} />
        
        <div className="p-6 space-y-6">
          {/* Nom du cercle */}
          <Card className="p-6 rounded-xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border-none">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{circle.name}</h2>
                <p className="text-muted-foreground">
                  {members.length} membre{members.length > 1 ? 's' : ''}
                </p>
              </div>
            </div>
          </Card>

          {/* Code d'invitation */}
          <Card className="p-4 rounded-xl">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">
              Code d'invitation
            </h3>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-muted rounded-lg px-4 py-3 font-mono text-2xl tracking-widest text-center">
                {circle.invitation_code}
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleCopyCode}
                className="h-12 w-12"
              >
                {copied ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Partagez ce code avec vos proches pour qu'ils rejoignent votre cercle
            </p>
          </Card>

          {/* Liste des membres */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Membres du cercle</h3>
            
            {members.map((member) => (
              <Card key={member.id} className="p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                    {member.user_id === circle.created_by ? (
                      <Crown className="w-5 h-5 text-primary" />
                    ) : (
                      <Users className="w-5 h-5 text-secondary-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">
                      {member.user_id === user.id ? 'Vous' : member.display_name}
                    </p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {member.role === 'senior' ? 'Aîné' : 'Aidant'}
                      {member.user_id === circle.created_by && ' • Créateur'}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {/* Actions */}
          {isCreator ? (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => navigate('/circle/manage')}
            >
              <Settings className="w-4 h-4 mr-2" />
              Gérer les membres
            </Button>
          ) : (
            <Button
              variant="outline"
              className="w-full text-destructive hover:text-destructive"
              onClick={handleLeaveCircle}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Quitter le cercle
            </Button>
          )}
          
          {/* Bottom spacing for nav */}
          <div className="h-20" />
        </div>
        <BottomNav />
      </PhoneFrame>
    );
  }

  // Pas de cercle - formulaires création/rejoindre
  return (
    <PhoneFrame>
      <TopBar title="Mon cercle" onBack={() => navigate(-1)} />
      
      <div className="p-6 space-y-6">
        <div className="text-center py-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center mb-4">
            <Users className="w-10 h-10 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Cercle familial</h2>
          <p className="text-muted-foreground">
            Créez ou rejoignez un cercle pour partager rappels et messages avec vos proches
          </p>
        </div>

        {/* Créer un cercle */}
        {showCreateForm ? (
          <Card className="p-4 rounded-xl space-y-4">
            <h3 className="font-semibold">Créer un cercle</h3>
            <Input
              placeholder="Nom du cercle (ex: Famille Dupont)"
              value={circleName}
              onChange={(e) => setCircleName(e.target.value)}
              className="rounded-lg"
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowCreateForm(false);
                  setCircleName("");
                }}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleCreateCircle}
                disabled={creating || !circleName.trim()}
              >
                {creating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Créer"
                )}
              </Button>
            </div>
          </Card>
        ) : (
          <BigButton
            variant="primary"
            icon={Plus}
            onClick={() => setShowCreateForm(true)}
          >
            Créer un cercle
          </BigButton>
        )}

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-background px-4 text-sm text-muted-foreground">ou</span>
          </div>
        </div>

        {/* Rejoindre un cercle */}
        {showJoinForm ? (
          <Card className="p-4 rounded-xl space-y-4">
            <h3 className="font-semibold">Rejoindre un cercle</h3>
            <Input
              placeholder="Code d'invitation (ex: ABC123)"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
              className="rounded-lg font-mono text-center text-lg tracking-widest"
              maxLength={6}
            />
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowJoinForm(false);
                  setInviteCode("");
                }}
              >
                Annuler
              </Button>
              <Button
                className="flex-1"
                onClick={handleJoinCircle}
                disabled={joining || inviteCode.length !== 6}
              >
                {joining ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Rejoindre"
                )}
              </Button>
            </div>
          </Card>
        ) : (
          <BigButton
            variant="secondary"
            icon={UserPlus}
            onClick={() => setShowJoinForm(true)}
          >
            Rejoindre avec un code
          </BigButton>
        )}
        
        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Circle;
