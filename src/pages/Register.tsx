import { PhoneFrame } from "@/components/PhoneFrame";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const Register = () => {
  const navigate = useNavigate();
  const { signUp, user, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/role");
    }
  }, [user, loading, navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }

    if (password.length < 6) {
      toast.error("Le mot de passe doit contenir au moins 6 caractères");
      return;
    }

    setIsSubmitting(true);
    
    const { error } = await signUp(email, password, displayName);
    
    if (error) {
      if (error.message.includes("already registered")) {
        toast.error("Cet email est déjà utilisé");
      } else {
        toast.error("Erreur lors de l'inscription: " + error.message);
      }
      setIsSubmitting(false);
    } else {
      toast.success("Compte créé avec succès !");
      navigate("/role");
    }
  };

  if (loading) {
    return (
      <PhoneFrame>
        <div className="flex items-center justify-center h-full">
          <div className="animate-pulse text-muted-foreground">Chargement...</div>
        </div>
      </PhoneFrame>
    );
  }

  return (
    <PhoneFrame>
      <TopBar title="Inscription" onBack={() => navigate("/")} />
      
      <div className="p-6 space-y-6">
        <div className="text-center pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Créer un compte</h2>
          <p className="text-muted-foreground">Rejoignez Silver Voice</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName" className="text-lg">Votre prénom</Label>
            <Input
              id="displayName"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Marie"
              className="h-14 text-lg rounded-xl"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="text-lg">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="votre@email.com"
              className="h-14 text-lg rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-lg">Mot de passe</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="h-14 text-lg rounded-xl"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-lg">Confirmer</Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="h-14 text-lg rounded-xl"
              required
            />
          </div>

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? "Création..." : "Créer mon compte"}
          </Button>
        </form>

        <div className="text-center pt-4 border-t border-border">
          <p className="text-muted-foreground mb-3">Déjà un compte ?</p>
          <Button
            variant="outline"
            onClick={() => navigate("/login")}
            className="w-full h-12 text-lg rounded-xl"
          >
            Se connecter
          </Button>
        </div>
      </div>
    </PhoneFrame>
  );
};

export default Register;
