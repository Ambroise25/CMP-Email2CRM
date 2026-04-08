import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import type { BienWithGestionnaire } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { AdresseLink } from "@/components/AdresseLink";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  MapPin,
  User,
  Info,
  ArrowLeft,
  Pencil,
  Calendar,
  Hash,
  Mail,
  Phone,
} from "lucide-react";

export default function BienDetail() {
  const { id } = useParams<{ id: string }>();

  const { data: bien, isLoading, error } = useQuery<BienWithGestionnaire>({
    queryKey: ["/api/biens", id],
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

  if (error || !bien) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <Card className="p-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1" data-testid="text-not-found">Bien non trouve</h3>
            <p className="text-muted-foreground mb-4">
              Ce bien n'existe pas ou a ete supprime.
            </p>
            <Link href="/">
              <Button variant="outline" data-testid="button-back-home">
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
          <Link href="/">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <Link href={`/biens/${bien.id}/edit`}>
            <Button data-testid="button-edit-bien">
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </Link>
        </div>

        <Card className="p-6" data-testid="card-bien-detail">
          <div className="flex items-start gap-4 mb-6">
            <div className="flex items-center justify-center h-12 w-12 rounded-md bg-primary/10 text-primary shrink-0">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-semibold text-foreground" data-testid="text-bien-adresse">
                  {bien.adresse}
                </h1>
                <Badge variant="outline" data-testid="text-bien-id">
                  <Hash className="w-3 h-3 mr-1" />
                  {bien.id}
                </Badge>
              </div>
              {bien.complementAdresse && (
                <p className="text-muted-foreground" data-testid="text-complement">
                  {bien.complementAdresse}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Localisation
              </p>
              <p className="font-medium" data-testid="text-localisation">
                <AdresseLink
                  adresse={`${bien.adresse} ${bien.codePostal} ${bien.ville}`}
                  codePostal=""
                  ville=""
                />
              </p>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                Date de creation
              </p>
              <p className="font-medium" data-testid="text-created">
                {new Date(bien.createdAt).toLocaleDateString("fr-FR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
          </div>

          {bien.information && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-muted-foreground flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5" />
                Informations complementaires
              </p>
              <p className="text-foreground" data-testid="text-information">
                {bien.information}
              </p>
            </div>
          )}
        </Card>

        {bien.gestionnaire && (
          <Card className="p-6 mt-4" data-testid="card-gestionnaire">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Gestionnaire
            </h2>
            <div className="space-y-3">
              <p className="font-medium text-foreground" data-testid="text-gestionnaire-nom">
                {bien.gestionnaire.nom}
              </p>
              {bien.gestionnaire.email && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5" data-testid="text-gestionnaire-email">
                  <Mail className="w-3.5 h-3.5" />
                  {bien.gestionnaire.email}
                </p>
              )}
              {bien.gestionnaire.telephone && (
                <p className="text-sm text-muted-foreground flex items-center gap-1.5" data-testid="text-gestionnaire-tel">
                  <Phone className="w-3.5 h-3.5" />
                  {bien.gestionnaire.telephone}
                </p>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
