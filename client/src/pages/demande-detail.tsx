import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { DemandeWithRelations } from "@shared/schema";
import { etatLabels } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { AdresseLink } from "@/components/AdresseLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ClipboardList,
  Building2,
  User,
  Calendar,
  Wrench,
  ArrowLeft,
  Pencil,
  Hash,
  Mail,
  Phone,
  MapPin,
  FileText,
  MessageSquare,
  Tag,
  Zap,
} from "lucide-react";

const etatColors: Record<string, string> = {
  nouvelle: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  en_cours: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  rdv_programme: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  terminee: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  annulee: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export default function DemandeDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: demande, isLoading, error } = useQuery<DemandeWithRelations>({
    queryKey: ["/api/demandes", id],
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Skeleton className="h-8 w-32 mb-8" />
          <Card className="p-6 space-y-6">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-20 w-full" />
          </Card>
        </div>
      </div>
    );
  }

  if (error || !demande) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-not-found">Demande non trouvee</h3>
            <p className="text-muted-foreground mb-4">
              Cette demande n'existe pas ou a ete supprimee.
            </p>
            <Link href="/demandes">
              <Button variant="outline" data-testid="button-back-list">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour a la liste
              </Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <Link href="/demandes">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <Link href={`/demandes/${demande.id}/edit`}>
            <Button data-testid="button-edit-demande">
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </Link>
        </div>

        <Card className="p-6" data-testid="card-demande-detail">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary/10 text-primary shrink-0">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold text-foreground" data-testid="text-demande-objet">
                  {demande.objet}
                </h1>
                <Badge variant="outline" data-testid="text-demande-id">
                  <Hash className="w-3 h-3 mr-1" />
                  {demande.id}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <Badge
                  className={etatColors[demande.etat] || ""}
                  data-testid="badge-etat"
                >
                  {etatLabels[demande.etat as keyof typeof etatLabels] || demande.etat}
                </Badge>
                <Badge variant="secondary" data-testid="badge-metier">
                  <Wrench className="w-3 h-3 mr-1" />
                  {demande.metier}
                </Badge>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Date demande client
              </p>
              <p className="font-medium" data-testid="text-date-demande">
                {new Date(demande.dateDemandeClient).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Date de creation
              </p>
              <p className="font-medium" data-testid="text-created">
                {new Date(demande.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>

            {demande.refSyndic && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5" />
                  Reference syndic
                </p>
                <p className="font-medium" data-testid="text-ref-syndic">
                  {demande.refSyndic}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5" />
                Travaux Enerpur
              </p>
              <p className="font-medium" data-testid="text-travaux-enerpur">
                {demande.travauxEnerpur ? "Oui" : "Non"}
              </p>
            </div>
          </div>

          {demande.detail && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5" />
                Detail
              </p>
              <p className="text-foreground" data-testid="text-detail">
                {demande.detail}
              </p>
            </div>
          )}

          {demande.commentaire && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                <MessageSquare className="w-3.5 h-3.5" />
                Commentaire
              </p>
              <p className="text-foreground" data-testid="text-commentaire">
                {demande.commentaire}
              </p>
            </div>
          )}
        </Card>

        {demande.bien && (
          <Card className="p-6 mt-4" data-testid="card-bien">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5" />
              Bien associe
            </h2>
            <Link href={`/biens/${demande.bien.id}`}>
              <div className="space-y-2 hover:bg-muted/50 rounded-md p-2 -m-2 transition-colors cursor-pointer">
                <p className="font-medium text-foreground" data-testid="text-bien-adresse">
                  {demande.bien.adresse}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <AdresseLink
                    adresse={`${demande.bien.adresse} ${demande.bien.codePostal} ${demande.bien.ville}`}
                    codePostal=""
                    ville=""
                  />
                </p>
              </div>
            </Link>
          </Card>
        )}

        {demande.gestionnaire && (
          <Card className="p-6 mt-4" data-testid="card-gestionnaire">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Gestionnaire
            </h2>
            <div className="space-y-3">
              <p className="font-medium text-foreground" data-testid="text-gestionnaire-nom">
                {demande.gestionnaire.nom}
              </p>
              {demande.gestionnaire.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5" data-testid="text-gestionnaire-email">
                  <Mail className="w-3.5 h-3.5" />
                  {demande.gestionnaire.email}
                </p>
              )}
              {demande.gestionnaire.telephone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5" data-testid="text-gestionnaire-tel">
                  <Phone className="w-3.5 h-3.5" />
                  {demande.gestionnaire.telephone}
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
