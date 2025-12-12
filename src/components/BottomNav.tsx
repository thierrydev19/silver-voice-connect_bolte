import { Home, Bell, MessageCircle, Users } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useUserProfile } from "@/hooks/useUserProfile";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface NotificationCounts {
  reminders: number;
  messages: number;
}

export const BottomNav = () => {
  const { role } = useUserProfile();
  const { user } = useAuth();
  const [counts, setCounts] = useState<NotificationCounts>({ reminders: 0, messages: 0 });
  const [circleId, setCircleId] = useState<string | null>(null);
  const [animatingBadges, setAnimatingBadges] = useState<{ reminders: boolean; messages: boolean }>({
    reminders: false,
    messages: false
  });
  const prevCountsRef = useRef<NotificationCounts>({ reminders: 0, messages: 0 });

  // Fetch circle ID
  useEffect(() => {
    const fetchCircleId = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from('circle_members')
        .select('circle_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        setCircleId(data.circle_id);
      }
    };

    fetchCircleId();
  }, [user]);

  // Trigger animation when counts increase
  useEffect(() => {
    const prev = prevCountsRef.current;
    
    if (counts.reminders > prev.reminders) {
      setAnimatingBadges(a => ({ ...a, reminders: true }));
      setTimeout(() => setAnimatingBadges(a => ({ ...a, reminders: false })), 2000);
    }
    
    if (counts.messages > prev.messages) {
      setAnimatingBadges(a => ({ ...a, messages: true }));
      setTimeout(() => setAnimatingBadges(a => ({ ...a, messages: false })), 2000);
    }
    
    prevCountsRef.current = counts;
  }, [counts]);

  // Fetch notification counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!circleId) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Count pending reminders for today
      const { count: remindersCount } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('circle_id', circleId)
        .in('status', ['pending', 'snoozed'])
        .gte('due_at', today.toISOString())
        .lt('due_at', tomorrow.toISOString());

      // Count messages from last 24h
      const yesterday = new Date();
      yesterday.setHours(yesterday.getHours() - 24);

      const { count: messagesCount } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('circle_id', circleId)
        .gte('created_at', yesterday.toISOString());

      setCounts({
        reminders: remindersCount || 0,
        messages: messagesCount || 0
      });
    };

    fetchCounts();

    // Real-time updates
    if (circleId) {
      const remindersChannel = supabase
        .channel('bottomnav-reminders')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'reminders',
          filter: `circle_id=eq.${circleId}`
        }, () => fetchCounts())
        .subscribe();

      const messagesChannel = supabase
        .channel('bottomnav-messages')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `circle_id=eq.${circleId}`
        }, () => fetchCounts())
        .subscribe();

      return () => {
        supabase.removeChannel(remindersChannel);
        supabase.removeChannel(messagesChannel);
      };
    }
  }, [circleId]);

  const seniorItems = [
    { icon: Home, label: "Accueil", to: "/senior", badge: 0, animating: false },
    { icon: Bell, label: "Rappels", to: "/reminders", badge: counts.reminders, animating: animatingBadges.reminders },
    { icon: MessageCircle, label: "Messages", to: "/messages", badge: counts.messages, animating: animatingBadges.messages },
    { icon: Users, label: "Cercle", to: "/circle", badge: 0, animating: false },
  ];

  const aidantItems = [
    { icon: Home, label: "Accueil", to: "/aidant", badge: 0, animating: false },
    { icon: Bell, label: "Rappels", to: "/reminders", badge: counts.reminders, animating: animatingBadges.reminders },
    { icon: MessageCircle, label: "Messages", to: "/messages", badge: counts.messages, animating: animatingBadges.messages },
    { icon: Users, label: "Cercle", to: "/circle", badge: 0, animating: false },
  ];

  const items = role === "senior" ? seniorItems : aidantItems;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border shadow-lg z-50">
      <div className="max-w-md mx-auto flex justify-around items-center py-2">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={cn(
              "flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors relative",
              "text-muted-foreground hover:text-primary hover:bg-primary/10"
            )}
            activeClassName="text-primary bg-primary/10"
          >
            <div className="relative">
              <item.icon className="w-6 h-6" />
              {item.badge > 0 && (
                <span 
                  className={cn(
                    "absolute -top-2 -right-2 min-w-[18px] h-[18px] flex items-center justify-center bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full px-1 transition-all",
                    item.animating && "animate-[pulse_0.5s_ease-in-out_4]"
                  )}
                >
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </div>
            <span className="text-xs font-medium">{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};
