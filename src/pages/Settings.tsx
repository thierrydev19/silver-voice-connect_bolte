import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { 
  User, 
  Bell, 
  Volume2, 
  Loader2, 
  Save,
  LogOut,
  Moon,
  Sun
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UserSettings {
  displayName: string;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  voiceFeedbackEnabled: boolean;
  voiceRate: number;
  darkMode: boolean;
}

const Settings = () => {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { firstName, role, loading: profileLoading } = useUserProfile();
  
  const [settings, setSettings] = useState<UserSettings>({
    displayName: "",
    notificationsEnabled: true,
    soundEnabled: true,
    voiceFeedbackEnabled: true,
    voiceRate: 0.85,
    darkMode: false
  });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load settings from localStorage and profile
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      // Load from localStorage
      const savedSettings = localStorage.getItem(`settings-${user.id}`);
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(prev => ({ ...prev, ...parsed }));
      }

      // Get display name from profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profile?.display_name) {
        setSettings(prev => ({ ...prev, displayName: profile.display_name || "" }));
      }

      // Check dark mode
      const isDark = document.documentElement.classList.contains('dark');
      setSettings(prev => ({ ...prev, darkMode: isDark }));

      setLoading(false);
    };

    loadSettings();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;

    setSaving(true);
    try {
      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({ display_name: settings.displayName })
        .eq('user_id', user.id);

      if (error) throw error;

      // Save other settings to localStorage
      const settingsToSave = {
        notificationsEnabled: settings.notificationsEnabled,
        soundEnabled: settings.soundEnabled,
        voiceFeedbackEnabled: settings.voiceFeedbackEnabled,
        voiceRate: settings.voiceRate,
        darkMode: settings.darkMode
      };
      localStorage.setItem(`settings-${user.id}`, JSON.stringify(settingsToSave));

      toast.success("Paramètres enregistrés");
    } catch (error) {
      console.error('Erreur:', error);
      toast.error("Erreur lors de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDarkMode = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, darkMode: enabled }));
    if (enabled) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading || profileLoading) {
    return (
      <PhoneFrame>
        <TopBar title="Paramètres" onBack={() => navigate(-1)} />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </PhoneFrame>
    );
  }

  if (!user) {
    return (
      <PhoneFrame>
        <TopBar title="Paramètres" onBack={() => navigate(-1)} />
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
          <User className="w-16 h-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Connexion requise</h2>
          <p className="text-muted-foreground mb-4">
            Connectez-vous pour accéder aux paramètres.
          </p>
          <Button onClick={() => navigate('/login')}>Se connecter</Button>
        </div>
      </PhoneFrame>
    );
  }

  const roleLabel = role === 'senior' ? 'Aîné' : 'Aidant';

  return (
    <PhoneFrame>
      <TopBar title="Paramètres" onBack={() => navigate(-1)} />
      
      <div className="p-6 space-y-6 min-h-screen bg-gradient-to-b from-background to-secondary/10">
        {/* Profil */}
        <Card className="p-4 rounded-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <User className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">Mon profil</h3>
          </div>
          
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="displayName">Prénom</Label>
              <Input
                id="displayName"
                value={settings.displayName}
                onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
                placeholder="Votre prénom"
                className="rounded-lg"
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Rôle</span>
              <span className="text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                {roleLabel}
              </span>
            </div>
            
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium truncate max-w-[180px]">
                {user.email}
              </span>
            </div>
          </div>
        </Card>

        {/* Notifications */}
        <Card className="p-4 rounded-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-accent-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Notifications</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Notifications push</p>
                <p className="text-sm text-muted-foreground">
                  Recevoir les alertes de rappels
                </p>
              </div>
              <Switch
                checked={settings.notificationsEnabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, notificationsEnabled: checked }))
                }
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Sons</p>
                <p className="text-sm text-muted-foreground">
                  Sons de notification
                </p>
              </div>
              <Switch
                checked={settings.soundEnabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, soundEnabled: checked }))
                }
              />
            </div>
          </div>
        </Card>

        {/* Voix */}
        <Card className="p-4 rounded-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-secondary-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Voix</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Retours vocaux</p>
                <p className="text-sm text-muted-foreground">
                  Confirmation audio des actions
                </p>
              </div>
              <Switch
                checked={settings.voiceFeedbackEnabled}
                onCheckedChange={(checked) => 
                  setSettings(prev => ({ ...prev, voiceFeedbackEnabled: checked }))
                }
              />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-medium">Vitesse de lecture</p>
                <span className="text-sm text-muted-foreground">
                  {Math.round(settings.voiceRate * 100)}%
                </span>
              </div>
              <Slider
                value={[settings.voiceRate]}
                onValueChange={([value]) => 
                  setSettings(prev => ({ ...prev, voiceRate: value }))
                }
                min={0.5}
                max={1.5}
                step={0.05}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Lent</span>
                <span>Rapide</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Apparence */}
        <Card className="p-4 rounded-xl space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              {settings.darkMode ? (
                <Moon className="w-5 h-5 text-muted-foreground" />
              ) : (
                <Sun className="w-5 h-5 text-primary" />
              )}
            </div>
            <h3 className="text-lg font-semibold">Apparence</h3>
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Mode sombre</p>
              <p className="text-sm text-muted-foreground">
                Interface en couleurs sombres
              </p>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={handleToggleDarkMode}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full rounded-xl h-12"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Save className="w-4 h-4 mr-2" />
            )}
            Enregistrer les paramètres
          </Button>
          
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full rounded-xl h-12 text-destructive hover:text-destructive"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Se déconnecter
          </Button>
        </div>

        {/* Bottom spacing for nav */}
        <div className="h-20" />
      </div>
      <BottomNav />
    </PhoneFrame>
  );
};

export default Settings;
