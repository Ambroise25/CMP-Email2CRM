import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Gestionnaire } from "@shared/schema";

interface GestionnaireComboboxProps {
  value: number | null | undefined;
  onChange: (value: number) => void;
  gestionnaires: Gestionnaire[];
  disabled?: boolean;
  "data-testid"?: string;
}

export function GestionnaireCombobox({
  value,
  onChange,
  gestionnaires,
  disabled,
  "data-testid": dataTestId,
}: GestionnaireComboboxProps) {
  const [open, setOpen] = React.useState(false);

  const selected = gestionnaires.find((g) => g.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          data-testid={dataTestId}
          className="w-full justify-between font-normal"
        >
          <span className="truncate">
            {selected ? selected.nom : "Selectionner un gestionnaire"}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Rechercher un gestionnaire..." data-testid="input-gestionnaire-search" />
          <CommandList>
            <CommandEmpty>Aucun gestionnaire trouve.</CommandEmpty>
            <CommandGroup>
              {gestionnaires.map((g) => (
                <CommandItem
                  key={g.id}
                  value={g.nom}
                  onSelect={() => {
                    onChange(g.id);
                    setOpen(false);
                  }}
                  data-testid={`option-gestionnaire-${g.id}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === g.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {g.nom}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
