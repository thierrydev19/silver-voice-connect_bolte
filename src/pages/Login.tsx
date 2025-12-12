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

const Login = () => {
  const navigate = useNavigate();
  const { signIn, user, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate("/role");
    }
  }, [user, loading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Email ou mot de passe incorrect");
      } else {
        toast.error("Erreur de connexion: " + error.message);
      }
      setIsSubmitting(false);
    } else {
      toast.success("Connexion réussie !");
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
      <TopBar title="Connexion" onBack={() => navigate("/")} />
      
      <div className="p-6 space-y-8">
        <div className="text-center pt-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Bon retour !</h2>
          <p className="text-muted-foreground">Connectez-vous pour continuer</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
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

          <Button
            type="submit"
            disabled={isSubmitting}
            className="w-full h-14 text-lg font-semibold rounded-xl bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <div className="text-center space-y-3">
          <button className="text-primary hover:text-primary/80 font-medium underline">
            Mot de passe oublié ?
          </button>
          
          <div className="pt-4 border-t border-border">
            <p className="text-muted-foreground mb-3">Pas encore de compte ?</p>
            <Button
              variant="outline"
              onClick={() => navigate("/register")}
              className="w-full h-12 text-lg rounded-xl"
            >
              Créer un compte
            </Button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
};

export default Login;
