import { useState } from "react";
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
import logo from "@/assets/logo.png";

// Mock data for rehearsals
const rehearsals = [
  {
    id: "hoffman-wedding",
    title: "Rehearsals for Hoffman Wedding",
    eventDate: new Date(new Date().setDate(new Date().getDate() + 30)),
    description: "Wedding reception at The Belvedere",
    proposedDates: [
      {
        id: "1",
        date: new Date(new Date().setDate(new Date().getDate() + 5)),
        time: "7:00 PM - 10:00 PM",
        location: "Main Studio, Baltimore",
        responses: { confirmed: 3, denied: 1, pending: 2 },
      },
      {
        id: "2",
        date: new Date(new Date().setDate(new Date().getDate() + 7)),
        time: "6:30 PM - 9:30 PM",
        location: "Main Studio, Baltimore",
        responses: { confirmed: 5, denied: 0, pending: 1 },
      },
      {
        id: "3",
        date: new Date(new Date().setDate(new Date().getDate() + 12)),
        time: "2:00 PM - 5:00 PM",
        location: "Rehearsal Space B, Columbia",
        responses: { confirmed: 1, denied: 4, pending: 1 },
      }
    ]
  }
];

export default function SchedulePage() {
  const [selectedRehearsal, setSelectedRehearsal] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [playerName, setPlayerName] = useState("");
  const [hasResponded, setHasResponded] = useState<Record<string, 'confirmed' | 'denied'>>({});

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

  // Rehearsal List View
  if (!selectedRehearsal) {
    return (
      <div className="container max-w-3xl py-24 mx-auto px-4">
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
              className="cursor-pointer hover:border-primary/50 transition-all duration-200 hover:shadow-md"
              onClick={() => setSelectedRehearsal(rehearsal.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold">{rehearsal.title}</h3>
                    <p className="text-muted-foreground">{rehearsal.description}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CalendarIcon className="w-4 h-4" />
                        Event: {format(rehearsal.eventDate, 'MMMM d, yyyy')}
                      </span>
                      <Badge variant="outline">
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Dates</CardTitle>
              <CardDescription>View dates with proposed rehearsals</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
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

        <div className="md:col-span-2 space-y-4">
          <h2 className="text-2xl font-display mb-4">Proposed Options</h2>
          
          {currentRehearsal?.proposedDates.length === 0 ? (
            <div className="text-center p-12 border rounded-xl bg-muted/20">
              <p className="text-muted-foreground">No proposed dates at the moment.</p>
            </div>
          ) : (
            currentRehearsal?.proposedDates.map((option) => (
              <Card key={option.id} className={`transition-all duration-200 ${hasResponded[option.id] === 'confirmed' ? 'border-green-500/50 bg-green-500/5' : hasResponded[option.id] === 'denied' ? 'border-red-500/50 bg-red-500/5' : ''}`}>
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
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

                    <div className="flex gap-3 w-full md:w-auto">
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
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}