import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import BiensList from "@/pages/biens-list";
import BienDetail from "@/pages/bien-detail";
import BienForm from "@/pages/bien-form";
import BienSearch from "@/pages/bien-search";

function Router() {
  return (
    <Switch>
      <Route path="/" component={BiensList} />
      <Route path="/biens/new" component={BienForm} />
      <Route path="/biens/search" component={BienSearch} />
      <Route path="/biens/:id/edit" component={BienForm} />
      <Route path="/biens/:id" component={BienDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
