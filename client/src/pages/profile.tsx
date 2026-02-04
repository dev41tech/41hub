import { useState, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Mail, 
  Building2, 
  Phone, 
  Save, 
  Upload, 
  Users, 
  Clock, 
  Star,
  ExternalLink,
  Loader2
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";
import type { TeamMember, ResourceWithHealth } from "@shared/schema";
import { useLocation } from "wouter";

function cleanPhoneNumber(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [whatsapp, setWhatsapp] = useState(user?.whatsapp || "");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const { data: team = [], isLoading: isLoadingTeam } = useQuery<TeamMember[]>({
    queryKey: ["/api/users/team"],
    enabled: !!user,
  });

  const { data: favorites = [], isLoading: isLoadingFavorites } = useQuery<ResourceWithHealth[]>({
    queryKey: ["/api/favorites"],
    enabled: !!user,
  });

  const { data: recentAccess = [], isLoading: isLoadingRecent } = useQuery<ResourceWithHealth[]>({
    queryKey: ["/api/resources/recent"],
    enabled: !!user,
  });

  const updateWhatsappMutation = useMutation({
    mutationFn: async (whatsappValue: string) => {
      return apiRequest("PATCH", "/api/users/me", { whatsapp: whatsappValue || null });
    },
    onSuccess: () => {
      refreshUser();
      toast({
        title: "WhatsApp atualizado",
        description: "Seu número foi salvo com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível salvar o WhatsApp.",
        variant: "destructive",
      });
    },
  });

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione uma imagem (JPG ou PNG).",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "A imagem deve ter no máximo 2MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("photo", file);

      const response = await fetch("/api/users/me/photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Upload failed");

      await refreshUser();
      queryClient.invalidateQueries({ queryKey: ["/api/users/team"] });
      toast({
        title: "Foto atualizada",
        description: "Sua foto de perfil foi salva.",
      });
    } catch (error) {
      toast({
        title: "Erro",
        description: "Não foi possível enviar a foto.",
        variant: "destructive",
      });
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container max-w-4xl py-8 px-4 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Meu Perfil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start gap-6">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-24 w-24">
                {user.photoUrl && <AvatarImage src={user.photoUrl} alt={user.name} />}
                <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handlePhotoUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                data-testid="button-upload-photo"
              >
                {isUploadingPhoto ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Alterar foto
              </Button>
            </div>

            <div className="flex-1 space-y-4">
              <div>
                <h2 className="text-2xl font-bold">{user.name}</h2>
                <p className="text-muted-foreground flex items-center gap-1 mt-1">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </p>
              </div>

              {user.roles && user.roles.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Setores e Papéis
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {user.roles.map((role, index) => (
                      <Badge key={index} variant="secondary">
                        {role.sectorName} - {role.roleName}
                      </Badge>
                    ))}
                    {user.isAdmin && (
                      <Badge variant="default" className="bg-primary">
                        Administrador
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <Label htmlFor="whatsapp" className="flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4" />
                  WhatsApp (opcional)
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="whatsapp"
                    type="tel"
                    placeholder="(41) 99999-9999"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="max-w-xs"
                    data-testid="input-whatsapp"
                  />
                  <Button
                    onClick={() => updateWhatsappMutation.mutate(whatsapp)}
                    disabled={updateWhatsappMutation.isPending}
                    data-testid="button-save-whatsapp"
                  >
                    {updateWhatsappMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    <span className="ml-2 hidden sm:inline">Salvar</span>
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Usado para o botão "Chamar no WhatsApp" visível para colegas do seu setor.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Meu Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTeam ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              ))}
            </div>
          ) : team.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nenhum colega no mesmo setor encontrado.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {team.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-card"
                >
                  <Avatar className="h-10 w-10">
                    {member.photoUrl && <AvatarImage src={member.photoUrl} alt={member.name} />}
                    <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                      {getInitials(member.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{member.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    {member.roles && member.roles.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {member.roles.slice(0, 2).map((role, i) => (
                          <Badge key={i} variant="outline" className="text-xs py-0">
                            {role.sectorName}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {member.whatsapp && (
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                      className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                    >
                      <a
                        href={`https://wa.me/${cleanPhoneNumber(member.whatsapp)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`button-whatsapp-${member.id}`}
                      >
                        <SiWhatsapp className="h-5 w-5" />
                      </a>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Minha Atividade
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Star className="h-4 w-4" />
              Favoritos
            </h3>
            {isLoadingFavorites ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-24" />
                ))}
              </div>
            ) : favorites.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum favorito ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {favorites.slice(0, 6).map((resource) => (
                  <Button
                    key={resource.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/resource/${resource.id}`)}
                    className="gap-2"
                    data-testid={`button-favorite-${resource.id}`}
                  >
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {resource.name}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Acessados Recentemente
            </h3>
            {isLoadingRecent ? (
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-10 w-24" />
                ))}
              </div>
            ) : recentAccess.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum acesso recente.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {recentAccess.slice(0, 6).map((resource) => (
                  <Button
                    key={resource.id}
                    variant="outline"
                    size="sm"
                    onClick={() => setLocation(`/resource/${resource.id}`)}
                    className="gap-2"
                    data-testid={`button-recent-${resource.id}`}
                  >
                    {resource.name}
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
