import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import type { BienMatch } from "@shared/schema";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  ArrowLeft,
  Building2,
  MapPin,
  User,
  Star,
  Target,
} from "lucide-react";

export default function BienSearch() {
  const [adresse, setAdresse] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [searchParams, setSearchParams] = useState<{ adresse: string; code_postal: string } | null>(null);

  const { data, isLoading, isFetched } = useQuery<{ matches: BienMatch[]; best_match: BienMatch | null }>({
    queryKey: ["/api/biens/search", `?adresse=${searchParams?.adresse}&code_postal=${searchParams?.code_postal}`],
    enabled: !!searchParams,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (adresse && codePostal) {
      setSearchParams({ adresse, code_postal: codePostal });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" data-testid="button-back">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-foreground" data-testid="text-search-title">
              Recherche avancee
            </h1>
            <p className="text-sm text-muted-foreground">
              Recherchez un bien par adresse et code postal avec scoring de similarite
            </p>
          </div>
        </div>

        <Card className="p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Adresse *
                </label>
                <Input
                  placeholder="Ex: ECONDEAUX, Rue Victor Hugo..."
                  value={adresse}
                  onChange={(e) => setAdresse(e.target.value)}
                  data-testid="input-search-adresse"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">
                  Code postal *
                </label>
                <Input
                  placeholder="93800"
                  value={codePostal}
                  onChange={(e) => setCodePostal(e.target.value)}
                  maxLength={5}
                  data-testid="input-search-code-postal"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!adresse || !codePostal || isLoading} data-testid="button-search">
                <Search className="w-4 h-4 mr-2" />
                {isLoading ? "Recherche en cours..." : "Rechercher"}
              </Button>
            </div>
          </form>
        </Card>

        {isFetched && data && (
          <>
            {data.best_match && (
              <div className="mb-4">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5" />
                  Meilleur resultat
                </h2>
                <Link href={`/biens/${data.best_match.bien.id}`}>
                  <Card className="p-4 border-primary/30 hover-elevate cursor-pointer" data-testid="card-best-match">
                    <div className="flex items-start gap-4">
                      <div className="flex items-center justify-center h-10 w-10 rounded-md bg-primary/10 text-primary shrink-0">
                        <Star className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="font-medium text-foreground" data-testid="text-best-match-adresse">
                            {data.best_match.bien.adresse}
                          </h3>
                          <Badge variant="default" data-testid="text-best-match-score">
                            Score: {Math.round(data.best_match.score * 100)}%
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5" />
                            {data.best_match.bien.codePostal} {data.best_match.bien.ville}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="w-3.5 h-3.5" />
                            {data.best_match.bien.gestionnaire?.nom}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Card>
                </Link>
              </div>
            )}

            {data.matches.length > 0 ? (
              <div>
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  {data.matches.length} resultat{data.matches.length > 1 ? "s" : ""} trouves
                </h2>
                <div className="space-y-3">
                  {data.matches.map((match) => (
                    <Link key={match.bien.id} href={`/biens/${match.bien.id}`}>
                      <Card
                        className="p-4 hover-elevate cursor-pointer"
                        data-testid={`card-match-${match.bien.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className="flex items-center justify-center h-10 w-10 rounded-md bg-muted text-muted-foreground shrink-0">
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="font-medium text-foreground">
                                {match.bien.adresse}
                              </h3>
                              {match.bien.complementAdresse && (
                                <Badge variant="secondary">
                                  {match.bien.complementAdresse}
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5" />
                                {match.bien.codePostal} {match.bien.ville}
                              </span>
                            </div>
                          </div>
                          <Badge
                            variant={match.score >= 0.8 ? "default" : "secondary"}
                            className="shrink-0"
                            data-testid={`badge-score-${match.bien.id}`}
                          >
                            {Math.round(match.score * 100)}%
                          </Badge>
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              <Card className="p-12 text-center">
                <Search className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-1" data-testid="text-no-results">
                  Aucun resultat
                </h3>
                <p className="text-muted-foreground">
                  Aucun bien ne correspond a cette recherche. Essayez avec des termes differents.
                </p>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
