import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { ArrowLeft, Settings, KeyRound, Save, Eye, EyeOff, Check, X } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface AdminSettings {
  DEFAULT_LOCAL_PASSWORD?: string;
}

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: "Mínimo 10 caracteres", test: (p) => p.length >= 10 },
  { label: "Uma letra maiúscula", test: (p) => /[A-Z]/.test(p) },
  { label: "Uma letra minúscula", test: (p) => /[a-z]/.test(p) },
  { label: "Um número", test: (p) => /[0-9]/.test(p) },
  { label: "Um caractere especial (!@#$%^&*)", test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

export default function AdminSettings() {
  const { toast } = useToast();
  const [defaultPassword, setDefaultPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const allRequirementsMet = passwordRequirements.every((r) => r.test(defaultPassword));

  const { data: settings, isLoading } = useQuery<AdminSettings>({
    queryKey: ["/api/admin/settings"],
  });

  useEffect(() => {
    if (settings?.DEFAULT_LOCAL_PASSWORD) {
      setDefaultPassword(settings.DEFAULT_LOCAL_PASSWORD);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: async (data: { key: string; value: string }) => {
      return apiRequest("PUT", "/api/admin/settings", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Configuração salva com sucesso" });
    },
    onError: () => {
      toast({ title: "Erro ao salvar configuração", variant: "destructive" });
    },
  });

  const handleSavePassword = () => {
    if (!allRequirementsMet) {
      toast({ title: "Senha não atende aos requisitos", variant: "destructive" });
      return;
    }
    updateMutation.mutate({ key: "DEFAULT_LOCAL_PASSWORD", value: defaultPassword });
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-5/10">
          <Settings className="h-5 w-5 text-chart-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-foreground">Configurações</h1>
          <p className="text-sm text-muted-foreground">
            Configurações do sistema
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-medium">
            <KeyRound className="h-4 w-4" />
            Senha Padrão para Usuários Locais
          </CardTitle>
          <CardDescription>
            Quando um novo usuário local é criado, ele recebe esta senha inicial. 
            O usuário será obrigado a alterá-la no primeiro login.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="defaultPassword">Senha Padrão</Label>
                <div className="relative">
                  <Input
                    id="defaultPassword"
                    type={showPassword ? "text" : "password"}
                    value={defaultPassword}
                    onChange={(e) => setDefaultPassword(e.target.value)}
                    placeholder="Senha padrão para novos usuários"
                    className="pr-10"
                    data-testid="input-default-password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {defaultPassword && (
                  <div className="space-y-1 text-sm mt-2">
                    {passwordRequirements.map((req, i) => {
                      const met = req.test(defaultPassword);
                      return (
                        <div key={i} className="flex items-center gap-2">
                          {met ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className={met ? "text-green-600" : "text-muted-foreground"}>
                            {req.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleSavePassword}
                  disabled={updateMutation.isPending || !allRequirementsMet}
                  data-testid="button-save-settings"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
