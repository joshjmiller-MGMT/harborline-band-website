import { useState, useRef, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, X, Clock, MapPin, ChevronRight, ArrowLeft, Home, Send, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import logo from "@/assets/logo-circle.png";

type ResponseEntry = { name: string; status: 'confirmed' | 'denied' };

// Mock data for rehearsals
const rehearsals = [
  {
    id: "hoffman-wedding",
    title: "Rehearsals for Hoffman Wedding",
    eventDate: new Date(2026, 2, 28),
    description: "Wedding reception at Gramercy Mansion",
    proposedDates: [
      { id: "1", date: new Date(2026, 2, 14), time: "9:00 AM - 12:00 PM", location: "TBD" },
      { id: "2", date: new Date(2026, 2, 14), time: "1:00 PM - 4:00 PM", location: "TBD" },
      { id: "3", date: new Date(2026, 2, 14), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "4", date: new Date(2026, 2, 15), time: "9:00 AM - 12:00 PM", location: "TBD" },
      { id: "5", date: new Date(2026, 2, 15), time: "1:00 PM - 4:00 PM", location: "TBD" },
      { id: "6", date: new Date(2026, 2, 15), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "7", date: new Date(2026, 2, 16), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "8", date: new Date(2026, 2, 17), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "9", date: new Date(2026, 2, 18), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "10", date: new Date(2026, 2, 22), time: "9:00 AM - 12:00 PM", location: "TBD" },
      { id: "11", date: new Date(2026, 2, 22), time: "1:00 PM - 4:00 PM", location: "TBD" },
      { id: "12", date: new Date(2026, 2, 22), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "13", date: new Date(2026, 2, 23), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "14", date: new Date(2026, 2, 24), time: "6:00 PM - 9:00 PM", location: "TBD" },
      { id: "15", date: new Date(2026, 2, 27), time: "6:00 PM - 9:00 PM", location: "TBD" },
    ]
  }
];

export default function SchedulePage() {
  const [selectedRehearsal, setSelectedRehearsal] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [playerName, setPlayerName] = useState("");
  const [localSelections, setLocalSelections] = useState<Record<string, 'confirmed' | 'denied'>>({});
  const [dbResponses, setDbResponses] = useState<Record<string, ResponseEntry[]>>({});
  const [respondersDialog, setRespondersDialog] = useState<{ optionId: string; filter: 'confirmed' | 'denied' } | null>(null);
  const [loading, setLoading] = useState(false);
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const currentRehearsal = rehearsals.find(r => r.id === selectedRehearsal);

  const fetchResponses = useCallback(async (rehearsalId: string) => {
    const { data, error } = await supabase
      .from('rehearsal_responses')
      .select('option_id, player_name, status')
      .eq('rehearsal_id', rehearsalId);

    if (error) {
      console.error('Error fetching responses:', error);
      return;
    }

    const grouped: Record<string, ResponseEntry[]> = {};
    for (const row of data || []) {
      if (!grouped[row.option_id]) grouped[row.option_id] = [];
      grouped[row.option_id].push({ name: row.player_name, status: row.status as 'confirmed' | 'denied' });
    }
    setDbResponses(grouped);
  }, []);

  useEffect(() => {
    if (selectedRehearsal) {
      fetchResponses(selectedRehearsal);
    }
  }, [selectedRehearsal, fetchResponses]);

  const handleLocalSelect = (id: string, status: 'confirmed' | 'denied') => {
    if (!playerName.trim()) {
      toast({ title: "Name required", description: "Please enter your name before responding.", variant: "destructive" });
      return;
    }
    setLocalSelections(prev => {
      if (prev[id] === status) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: status };
    });
  };

  const handleSubmit = async () => {
    if (!playerName.trim()) {
      toast({ title: "Name required", description: "Please enter your name before submitting.", variant: "destructive" });
      return;
    }
    if (Object.keys(localSelections).length === 0) {
      toast({ title: "No selections", description: "Please mark your availability for at least one date.", variant: "destructive" });
      return;
    }

    setLoading(true);
    const rehearsalId = selectedRehearsal!;
    const rows = Object.entries(localSelections).map(([optionId, status]) => ({
      rehearsal_id: rehearsalId,
      option_id: optionId,
      player_name: playerName.trim(),
      status,
    }));

    // Upsert each response
    for (const row of rows) {
      const { error } = await supabase
        .from('rehearsal_responses')
        .upsert(row, { onConflict: 'rehearsal_id,option_id,player_name' });

      if (error) {
        console.error('Error saving response:', error);
        toast({ title: "Error", description: "Failed to save some responses.", variant: "destructive" });
        setLoading(false);
        return;
      }
    }

    await fetchResponses(rehearsalId);
    setLocalSelections({});
    setLoading(false);

    toast({
      title: "Availability submitted!",
      description: `Your responses for ${rows.length} date(s) have been saved.`,
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      const matchingOption = currentRehearsal?.proposedDates.find(d =>
        d.date.toDateString() === date.toDateString()
      );
      if (matchingOption && optionRefs.current[matchingOption.id]) {
        optionRefs.current[matchingOption.id]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const getOptionCounts = (optionId: string) => {
    const responses = dbResponses[optionId] || [];
    return {
      confirmed: responses.filter(r => r.status === 'confirmed').length,
      denied: responses.filter(r => r.status === 'denied').length,
    };
  };

  const getRespondersForOption = (optionId: string, filter: 'confirmed' | 'denied') => {
    const responses = dbResponses[optionId] || [];
    return responses.filter(r => r.status === filter);
  };

  // Rehearsal List View
  if (!selectedRehearsal) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="container max-w-3xl mx-auto px-4 py-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <Home className="w-4 h-4" />
              <span className="text-sm">Back to Home</span>
            </Link>
          </div>
        </div>

        <div className="container max-w-3xl py-16 mx-auto px-4">
          <div className="space-y-4 mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-display text-foreground">Rehearsal Schedule</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Select a rehearsal to view available dates and RSVP.
            </p>
          </div>

          <div className="space-y-4">
            {rehearsals.map((rehearsal) => (
              <Card
                key={rehearsal.id}
                className="cursor-pointer border-border/50 hover:border-primary/50 transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 bg-card/80"
                onClick={() => setSelectedRehearsal(rehearsal.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2">
                      <h3 className="text-xl font-semibold text-foreground">{rehearsal.title}</h3>
                      <p className="text-muted-foreground">{rehearsal.description}</p>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4 text-primary" />
                          Event: {format(rehearsal.eventDate, 'MMMM d, yyyy')}
                        </span>
                        <Badge variant="outline" className="border-primary/30 text-primary">
                          {rehearsal.proposedDates.length} date options
                        </Badge>
                      </div>
                    </div>
                    <ChevronRight className="w-6 h-6 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="flex justify-center mt-16 mb-8">
            <img src={logo} alt="Harborline" className="w-40 md:w-56 opacity-60" />
          </div>
        </div>
      </div>
    );
  }

  // Rehearsal Detail View
  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-6xl mx-auto">
        <Button
          variant="ghost"
          className="mb-8 gap-2"
          onClick={() => { setSelectedRehearsal(null); setLocalSelections({}); }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to all rehearsals
        </Button>

        <div className="space-y-3 mb-10 text-center">
          <h1 className="text-4xl md:text-5xl font-display text-foreground">{currentRehearsal?.title}</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Review the proposed dates below and confirm your availability.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="overflow-hidden">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Calendar View</CardTitle>
                <CardDescription>Click highlighted dates to jump to options</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 pb-6 flex justify-center">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={handleDateSelect}
                  className="rounded-md pointer-events-auto scale-95"
                  modifiers={{
                    proposed: currentRehearsal?.proposedDates.map(d => d.date) || [],
                  }}
                  modifiersStyles={{
                    proposed: { fontWeight: 'bold', backgroundColor: 'hsl(var(--primary) / 0.15)', color: 'hsl(var(--primary))' }
                  }}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Your Details</CardTitle>
                <CardDescription>Enter your name to RSVP</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  <Label htmlFor="playerName">Name</Label>
                  <Input
                    id="playerName"
                    placeholder="e.g. John (Drums)"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Proposed Options */}
          <div className="lg:col-span-2">
            <Card className="h-fit">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-display">Proposed Rehearsal Options</CardTitle>
                <CardDescription>Review and respond to each proposed date below</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 max-h-[650px] overflow-y-auto">
                {currentRehearsal?.proposedDates.map((option) => {
                  const counts = getOptionCounts(option.id);
                  const selected = localSelections[option.id];
                  return (
                    <div
                      key={option.id}
                      ref={(el) => { optionRefs.current[option.id] = el; }}
                      className={`border rounded-xl p-6 transition-all duration-200 ${
                        selected === 'confirmed' ? 'border-green-500/50 bg-green-500/5' :
                        selected === 'denied' ? 'border-red-500/50 bg-red-500/5' :
                        'border-border/50'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-primary/10 p-3 rounded-lg text-primary">
                              <CalendarIcon className="w-6 h-6" />
                            </div>
                            <div>
                              <h3 className="text-xl font-semibold">{format(option.date, 'EEEE, MMMM do, yyyy')}</h3>
                              <div className="flex items-center gap-4 text-muted-foreground mt-1">
                                <span className="flex items-center gap-1 text-sm">
                                  <Clock className="w-4 h-4" />
                                  {option.time}
                                </span>
                                <span className="flex items-center gap-1 text-sm">
                                  <MapPin className="w-4 h-4" />
                                  {option.location}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex gap-2 items-center text-sm pt-2">
                            <Badge
                              variant="outline"
                              className="bg-green-500/10 text-green-600 border-green-500/20 cursor-pointer hover:bg-green-500/20 transition-colors"
                              onClick={() => setRespondersDialog({ optionId: option.id, filter: 'confirmed' })}
                            >
                              <Users className="w-3 h-3 mr-1" />
                              {counts.confirmed} Confirmed
                            </Badge>
                            <Badge
                              variant="outline"
                              className="bg-red-500/10 text-red-600 border-red-500/20 cursor-pointer hover:bg-red-500/20 transition-colors"
                              onClick={() => setRespondersDialog({ optionId: option.id, filter: 'denied' })}
                            >
                              <Users className="w-3 h-3 mr-1" />
                              {counts.denied} Unavailable
                            </Badge>
                          </div>
                        </div>

                        <div className="flex gap-3 w-full lg:w-auto">
                          <Button
                            variant={selected === 'confirmed' ? 'default' : 'outline'}
                            className={`flex-1 md:w-32 gap-2 ${selected === 'confirmed' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 hover:text-green-600 hover:border-green-200'}`}
                            onClick={() => handleLocalSelect(option.id, 'confirmed')}
                          >
                            <Check className="w-4 h-4" />
                            Available
                          </Button>
                          <Button
                            variant={selected === 'denied' ? 'destructive' : 'outline'}
                            className={`flex-1 md:w-32 gap-2 ${selected === 'denied' ? '' : 'hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}
                            onClick={() => handleLocalSelect(option.id, 'denied')}
                          >
                            <X className="w-4 h-4" />
                            Can't Make It
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>

              {Object.keys(localSelections).length > 0 && (
                <div className="p-6 pt-4 border-t border-border/50">
                  <Button onClick={handleSubmit} size="lg" className="w-full gap-2" disabled={loading}>
                    <Send className="w-4 h-4" />
                    {loading ? 'Submitting...' : `Submit Availability (${Object.keys(localSelections).length} response${Object.keys(localSelections).length !== 1 ? 's' : ''})`}
                  </Button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* Responders Dialog */}
      <Dialog open={!!respondersDialog} onOpenChange={() => setRespondersDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {respondersDialog?.filter === 'confirmed' ? 'Confirmed' : 'Unavailable'} Responses
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2 mt-2">
            {respondersDialog && (() => {
              const responders = getRespondersForOption(respondersDialog.optionId, respondersDialog.filter);
              if (responders.length === 0) {
                return <p className="text-muted-foreground text-sm py-4 text-center">No responses yet.</p>;
              }
              return responders.map((r, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={`w-2 h-2 rounded-full ${r.status === 'confirmed' ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className="font-medium">{r.name}</span>
                </div>
              ));
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
