import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-provider";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Moon, Sun, Mail, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();

  const updateThemeMutation = useMutation({
    mutationFn: async (themePref: "light" | "dark") => {
      return apiRequest("PATCH", "/api/users/me", { themePref });
    },
    onSuccess: () => {
      refreshUser();
      toast({
        title: "Tema atualizado",
        description: "Sua preferência de tema foi salva.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar a preferência de tema.",
        variant: "destructive",
      });
    },
  });

  const handleToggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    toggleTheme();
    updateThemeMutation.mutate(newTheme);
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container max-w-2xl py-8 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-2xl">{user.name}</CardTitle>
              <CardDescription className="flex items-center gap-1 mt-1">
                <Mail className="h-4 w-4" />
                {user.email}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {user.roles && user.roles.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Setores e Papéis
              </h3>
              <div className="flex flex-wrap gap-2">
                {user.roles.map((role, index) => (
                  <Badge key={index} variant="secondary" className="text-sm">
                    {role.sectorName} - {role.roleName}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {user.isAdmin && (
            <div>
              <Badge variant="default" className="bg-primary">
                Administrador
              </Badge>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-3">Preferências</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Tema</p>
                <p className="text-sm text-muted-foreground">
                  {theme === "dark" ? "Modo escuro" : "Modo claro"}
                </p>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={handleToggleTheme}
                disabled={updateThemeMutation.isPending}
                data-testid="button-toggle-theme"
              >
                {theme === "dark" ? (
                  <Sun className="h-5 w-5" />
                ) : (
                  <Moon className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
