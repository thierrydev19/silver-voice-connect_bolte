import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, Trash2, Edit2, Crown, Loader2, Shield, Save, X } from "lucide-react";
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
  role: 'senior' | 'aidant';
  display_name: string | null;
}

const CircleManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [circle, setCircle] = useState<Circle | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingMember, setEditingMember] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<'senior' | 'aidant'>('aidant');
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchCircleData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Récupérer le cercle créé par l'utilisateur
        const { data: circleData } = await supabase
          .from('circles')
          .select('*')
          .eq('created_by', user.id)
          .maybeSingle();

        if (!circleData) {
          setLoading(false);
          return;
        }

        setCircle(circleData);

        // Récupérer les membres
        const { data: membersData } = await supabase
          .from('circle_members')
          .select('id, user_id, role')
          .eq('circle_id', circleData.id);

        if (membersData) {
          const userIds = membersData.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, display_name')
            .in('user_id', userIds);

          const profileMap = new Map(profiles?.map(p => [p.user_id, p.display_name]) || []);
          
          const membersWithNames = membersData.map(m => ({
            ...m,
            role: m.role as 'senior' | 'aidant',
            display_name: profileMap.get(m.user_id) || 'Membre'
          }));
          
          setMembers(membersWithNames);
        }
      } catch (error) {
        console.error('Erreur:', error);
        toast.error("Erreur lors du chargement");
      } finally {
        setLoading(false);
      }
    };

    fetchCircleData();
  }, [user]);

  const handleUpdateRole = async (memberId: string) => {
    if (!circle) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('circle_members')
        .update({ role: editRole })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(prev => prev.map(m => 
        m.id === memberId ? { ...m, role: editRole } : m
      ));
      setEditingMember(null);
      toast.success("Rôle mis à jour");
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!memberToDelete || !circle) return;

    try {
      const { error } = await supabase
        .from('circle_members')
        .delete()
        .eq('id', memberToDelete.id);

      if (error) throw error;

      setMembers(prev => prev.filter(m => m.id !== memberToDelete.id));
      setMemberToDelete(null);
      toast.success("Membre supprimé du cercle");
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de la suppression");
    }
  };

  const startEditing = (member: Member) => {
    setEditingMember(member.id);
    setEditRole(member.role);
  };

  if (loading) {
    return (
      <PhoneFrame>
        <TopBar title="Gestion du cercle" onBack={() => navigate('/circle')} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  if (!user) {
    return (
      <PhoneFrame>
        <TopBar title="Gestion du cercle" onBack={() => navigate('/circle')} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Shield className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
          <p className="text-muted-foreground mb-4">
            Connectez-vous pour gérer votre cercle.
          </p>
          <Button onClick={() => navigate('/login')}>Se connecter</Button>
        </div>
      </PhoneFrame>
    );
  }

  if (!circle) {
    return (
      <PhoneFrame>
        <TopBar title="Gestion du cercle" onBack={() => navigate('/circle')} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <Shield className="w-16 h-16 text-destructive/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
          <p className="text-muted-foreground mb-4">
            Seul le créateur du cercle peut accéder à cette page.
          </p>
          <Button variant="outline" onClick={() => navigate('/circle')}>
            Retour au cercle
          </Button>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Gestion du cercle" onBack={() => navigate('/circle')} />
      
      <div className="p-6 space-y-6">
        {/* En-tête */}
        <Card className="p-4 rounded-xl bg-gradient-to-br from-primary/10 via-secondary/10 to-accent/10 border-none">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Crown className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{circle.name}</h2>
              <p className="text-sm text-muted-foreground">
                {members.length} membre{members.length > 1 ? 's' : ''}
              </p>
            </div>
          </div>
        </Card>

        {/* Liste des membres */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Membres du cercle
          </h3>
          
          {members.map((member) => {
            const isCreator = member.user_id === circle.created_by;
            const isEditing = editingMember === member.id;

            return (
              <Card key={member.id} className="p-4 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                    {isCreator ? (
                      <Crown className="w-5 h-5 text-primary" />
                    ) : (
                      <Users className="w-5 h-5 text-secondary-foreground" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {member.user_id === user.id ? 'Vous' : member.display_name}
                    </p>
                    
                    {isEditing ? (
                      <div className="flex items-center gap-2 mt-2">
                        <Select
                          value={editRole}
                          onValueChange={(v) => setEditRole(v as 'senior' | 'aidant')}
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="senior">Aîné</SelectItem>
                            <SelectItem value="aidant">Aidant</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => handleUpdateRole(member.id)}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Save className="w-4 h-4 text-green-600" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => setEditingMember(null)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground capitalize">
                        {member.role === 'senior' ? 'Aîné' : 'Aidant'}
                        {isCreator && ' • Créateur'}
                      </p>
                    )}
                  </div>

                  {!isCreator && !isEditing && (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={() => startEditing(member)}
                      >
                        <Edit2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={() => setMemberToDelete(member)}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Partagez le code <span className="font-mono font-bold">{circle.invitation_code}</span> pour inviter de nouveaux membres
        </p>
        
        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>

      {/* Dialog de confirmation de suppression */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              {memberToDelete?.display_name} sera retiré du cercle et n'aura plus accès aux rappels et messages.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <BottomNav />
    </PhoneFrame>
  );
};

export default CircleManagement;
