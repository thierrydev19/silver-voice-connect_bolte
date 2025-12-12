import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Menu from "./pages/Menu";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Role from "./pages/Role";
import Senior from "./pages/Senior";
import Aidant from "./pages/Aidant";
import Reminders from "./pages/Reminders";
import Morning from "./pages/Morning";
import Messages from "./pages/Messages";
import Circle from "./pages/Circle";
import CircleManagement from "./pages/CircleManagement";
import Settings from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Menu />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/role" element={<Role />} />
            <Route path="/senior" element={<Senior />} />
            <Route path="/aidant" element={<Aidant />} />
            <Route path="/reminders" element={<Reminders />} />
            <Route path="/morning" element={<Morning />} />
            <Route path="/messages" element={<Messages />} />
            <Route path="/circle" element={<Circle />} />
            <Route path="/circle/manage" element={<CircleManagement />} />
            <Route path="/settings" element={<Settings />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
