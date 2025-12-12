import { PhoneFrame } from "@/components/PhoneFrame";
import { BigButton } from "@/components/BigButton";
import { Heart, Users, Bell, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Menu = () => {
  const navigate = useNavigate();

  return (
    <PhoneFrame>
      <div className="min-h-screen flex flex-col">
        {/* Header avec logo */}
        <div className="bg-gradient-to-br from-primary via-primary/90 to-secondary p-6 sm:p-8 md:p-10 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 bg-white/20 rounded-full mb-3 sm:mb-4 backdrop-blur-sm">
            <Heart className="w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12 text-white" fill="currentColor" />
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-2">Silver Voice</h1>
          <p className="text-white/90 text-base sm:text-lg md:text-xl">Votre assistant du quotidien</p>
        </div>

        {/* Contenu principal */}
        <div className="flex-1 p-4 sm:p-6 md:p-8 space-y-6 sm:space-y-8">
          <div className="space-y-3 sm:space-y-4">
            <h2 className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground/80">Je suis...</h2>
            <div className="grid gap-4 sm:gap-5 md:gap-6">
              <BigButton
                variant="primary"
                icon={Heart}
                onClick={() => navigate("/role?type=senior")}
              >
                Un aîné
              </BigButton>
              <BigButton
                variant="secondary"
                icon={Users}
                onClick={() => navigate("/role?type=aidant")}
              >
                Un aidant
              </BigButton>
            </div>
          </div>

          {/* Fonctionnalités */}
          <div className="pt-4 sm:pt-6 space-y-3 sm:space-y-4">
            <h3 className="text-base sm:text-lg md:text-xl font-medium text-muted-foreground">Fonctionnalités</h3>
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              <div className="bg-secondary/30 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-center">
                <Bell className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-primary" />
                <p className="text-sm sm:text-base md:text-lg font-medium">Rappels vocaux</p>
              </div>
              <div className="bg-accent/30 rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 text-center">
                <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-primary" />
                <p className="text-sm sm:text-base md:text-lg font-medium">Messages famille</p>
              </div>
            </div>
          </div>

          {/* Bouton connexion */}
          <div className="pt-4 sm:pt-6">
            <button
              onClick={() => navigate("/login")}
              className="w-full text-center text-primary hover:text-primary/80 text-base sm:text-lg md:text-xl font-medium underline underline-offset-4 py-3 sm:py-4 touch-manipulation"
            >
              J'ai déjà un compte
            </button>
          </div>
        </div>
      </div>
    </PhoneFrame>
  );
};

export default Menu;
