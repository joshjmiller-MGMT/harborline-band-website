import { useState, useRef } from "react";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Check, X, Clock, MapPin, ChevronRight, ArrowLeft, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import logo from "@/assets/logo-circle.png";

// Mock data for rehearsals
const rehearsals = [
  {
    id: "hoffman-wedding",
    title: "Rehearsals for Hoffman Wedding",
    eventDate: new Date(new Date().setDate(new Date().getDate() + 30)),
    description: "Wedding reception at The Belvedere",
    proposedDates: [
      { id: "1", date: new Date(2026, 2, 14), time: "9:00 AM - 12:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "2", date: new Date(2026, 2, 14), time: "1:00 PM - 4:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "3", date: new Date(2026, 2, 14), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "4", date: new Date(2026, 2, 15), time: "9:00 AM - 12:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "5", date: new Date(2026, 2, 15), time: "1:00 PM - 4:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "6", date: new Date(2026, 2, 15), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "7", date: new Date(2026, 2, 16), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "8", date: new Date(2026, 2, 17), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "9", date: new Date(2026, 2, 18), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "10", date: new Date(2026, 2, 22), time: "9:00 AM - 12:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "11", date: new Date(2026, 2, 22), time: "1:00 PM - 4:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "12", date: new Date(2026, 2, 22), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "13", date: new Date(2026, 2, 23), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "14", date: new Date(2026, 2, 24), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
      { id: "15", date: new Date(2026, 2, 27), time: "6:00 PM - 9:00 PM", location: "TBD", responses: { confirmed: 0, denied: 0, pending: 0 } },
    ]
  }
];

export default function SchedulePage() {
  const [selectedRehearsal, setSelectedRehearsal] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [playerName, setPlayerName] = useState("");
  const [hasResponded, setHasResponded] = useState<Record<string, 'confirmed' | 'denied'>>({});
  const optionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const currentRehearsal = rehearsals.find(r => r.id === selectedRehearsal);

  const handleResponse = (id: string, status: 'confirmed' | 'denied') => {
    if (!playerName.trim()) {
      toast({
        title: "Name required",
        description: "Please enter your name before responding.",
        variant: "destructive",
      });
      return;
    }

    setHasResponded(prev => ({ ...prev, [id]: status }));
    const dateOption = currentRehearsal?.proposedDates.find(d => d.id === id);
    toast({
      title: "Response recorded",
      description: `You have ${status === 'confirmed' ? 'confirmed' : 'declined'} the rehearsal on ${format(dateOption?.date || new Date(), 'MMM d')}.`,
    });
  };

  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date);
    if (date) {
      // Find matching proposed date and scroll to it
      const matchingOption = currentRehearsal?.proposedDates.find(d => 
        d.date.toDateString() === date.toDateString()
      );
      if (matchingOption && optionRefs.current[matchingOption.id]) {
        optionRefs.current[matchingOption.id]?.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        });
      }
    }
  };

  // Rehearsal List View
  if (!selectedRehearsal) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
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

          {/* Logo at bottom */}
          <div className="flex justify-center mt-16 mb-8">
            <img src={logo} alt="Harborline" className="w-40 md:w-56 opacity-60" />
          </div>
        </div>
      </div>
    );
  }

  // Rehearsal Detail View
  return (
    <div className="container max-w-5xl py-24 mx-auto px-4">
      <Button 
        variant="ghost" 
        className="mb-6 gap-2"
        onClick={() => setSelectedRehearsal(null)}
      >
        <ArrowLeft className="w-4 h-4" />
        Back to all rehearsals
      </Button>

      <div className="space-y-4 mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-display text-foreground">{currentRehearsal?.title}</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Review the proposed dates below and confirm your availability.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Calendar and Details Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Dates</CardTitle>
              <CardDescription>Click dates to jump to options</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="rounded-md border pointer-events-auto"
                modifiers={{
                  proposed: currentRehearsal?.proposedDates.map(d => d.date) || [],
                }}
                modifiersStyles={{
                  proposed: { fontWeight: 'bold', backgroundColor: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Your Details</CardTitle>
              <CardDescription>Enter your name to RSVP</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
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

        {/* Proposed Options Container */}
        <div className="lg:col-span-3">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-2xl font-display">Proposed Rehearsal Options</CardTitle>
              <CardDescription>Review and respond to each proposed date below</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {currentRehearsal?.proposedDates.length === 0 ? (
                <div className="text-center p-12 border rounded-xl bg-muted/20">
                  <p className="text-muted-foreground">No proposed dates at the moment.</p>
                </div>
              ) : (
                currentRehearsal?.proposedDates.map((option) => (
                  <div 
                    key={option.id}
                    ref={(el) => { optionRefs.current[option.id] = el; }}
                    className={`border rounded-xl p-6 transition-all duration-200 ${hasResponded[option.id] === 'confirmed' ? 'border-green-500/50 bg-green-500/5' : hasResponded[option.id] === 'denied' ? 'border-red-500/50 bg-red-500/5' : 'border-border/50'}`}
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
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                            {option.responses.confirmed} Confirmed
                          </Badge>
                          <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/20">
                            {option.responses.denied} Unavailable
                          </Badge>
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
                            {option.responses.pending} Pending
                          </Badge>
                        </div>
                      </div>

                      <div className="flex gap-3 w-full lg:w-auto">
                        <Button
                        variant={hasResponded[option.id] === 'confirmed' ? 'default' : 'outline'}
                        className={`flex-1 md:w-32 gap-2 ${hasResponded[option.id] === 'confirmed' ? 'bg-green-600 hover:bg-green-700' : 'hover:bg-green-50 hover:text-green-600 hover:border-green-200'}`}
                        onClick={() => handleResponse(option.id, 'confirmed')}
                      >
                        <Check className="w-4 h-4" />
                        Available
                      </Button>
                      <Button 
                        variant={hasResponded[option.id] === 'denied' ? 'destructive' : 'outline'}
                        className={`flex-1 md:w-32 gap-2 ${hasResponded[option.id] === 'denied' ? '' : 'hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}
                        onClick={() => handleResponse(option.id, 'denied')}
                      >
                          <X className="w-4 h-4" />
                          Can't Make It
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}