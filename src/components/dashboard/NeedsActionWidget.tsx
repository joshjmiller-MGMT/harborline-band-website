import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown } from "lucide-react";
import MissingDatesWidget from "./MissingDatesWidget";
import TodaysActionItemsWidget from "./TodaysActionItemsWidget";
import BookingAgentActionWidget from "./BookingAgentActionWidget";
import WaitingOnJoshWidget from "./WaitingOnJoshWidget";
import { StaffingNeedsAction } from "./StaffingWidget";
import { EveningAvailabilityNeedsAction } from "./EveningAvailabilityWidget";

export default function NeedsActionWidget() {
  const [open, setOpen] = useState(true);

  return (
    <Card className="bg-card/50 border-destructive/40 lg:col-span-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <CardTitle className="font-display text-lg tracking-wide-custom flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Needs Action
            </CardTitle>
            <Button variant="ghost" size="icon" asChild>
              <span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </span>
            </Button>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-4">
            <WaitingOnJoshWidget />
            <TodaysActionItemsWidget />
            <BookingAgentActionWidget />
            <MissingDatesWidget />
            <StaffingNeedsAction />
            <EveningAvailabilityNeedsAction />
            {/* More action items can be slotted in here as they come up. */}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
