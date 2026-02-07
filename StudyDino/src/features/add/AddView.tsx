import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BackButton from "@/components/routing/BackButton";
import { getMaxDateForEvent, containsProfanity } from '@/lib/utils';
import { Map, MapMarker } from '@/components/ui/map'; // Import Map and MapMarker

// Mock data for address suggestions with coordinates
const MOCK_ADDRESS_SUGGESTIONS = [
  { address: "1600 Amphitheatre Parkway, Mountain View, CA", coords: [-122.084, 37.422] },
  { address: "1 Infinite Loop, Cupertino, CA", coords: [-122.032, 37.332] },
  { address: "34.0522, -118.2437 (Los Angeles)", coords: [-118.2437, 34.0522] },
  { address: "4 Privet Drive, Little Whinging, Surrey", coords: [-0.478, 51.409] }, // Fictional, approximate coords
  { address: "221B Baker Street, London", coords: [-0.158, 51.523] },
  { address: "Eiffel Tower, Champ de Mars, 75007 Paris, France", coords: [2.2945, 48.8584] },
  { address: "Buckingham Palace, London SW1A 1AA, UK", coords: [-0.141, 51.501] },
  { address: "Central Park, New York, NY 10024, USA", coords: [-73.968, 40.785] },
];

export function AddView() {
  const [eventName, setEventName] = useState('');
  const [location, setLocation] = useState('');
  const [group, setGroup] = useState('');
  const [dateTime, setDateTime] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [locationSuggestions, setLocationSuggestions] = useState<
    { address: string; coords: [number, number] | null }[]
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [displayCoordinates, setDisplayCoordinates] = useState<[number, number] | null>(null);

  const maxDateTime = getMaxDateForEvent();

  // Basic regex for address (e.g., "123 Main St, Anytown") or coordinates (e.g., "34.0522, -118.2437")
  const addressRegex = /\d+\s[A-Za-z]+\s[A-Za-z]+(?:.*)?/;
  const coordinatesRegex = /^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/;

  const getCoordinatesFromLocation = useCallback((value: string): [number, number] | null => {
    // Try to parse as coordinates directly (MapLibreGL expects [lng, lat])
    const coordsMatch = value.match(/^(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return [lng, lat];
      }
    }

    // Try to find in mock suggestions (exact match for address string)
    const matchedSuggestion = MOCK_ADDRESS_SUGGESTIONS.find(suggestion =>
      suggestion.address.toLowerCase() === value.toLowerCase()
    );
    if (matchedSuggestion?.coords) {
      return matchedSuggestion.coords;
    }

    // Fallback: Check for partial match for non-coordinate addresses
    const partialMatch = MOCK_ADDRESS_SUGGESTIONS.find(suggestion =>
        suggestion.address.toLowerCase().includes(value.toLowerCase()) && suggestion.coords !== null
    );
    if (partialMatch?.coords) {
        return partialMatch.coords;
    }

    return null;
  }, []);

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocation(value);

    const newCoords = getCoordinatesFromLocation(value);
    setDisplayCoordinates(newCoords);

    if (value.length > 2) {
      const filteredSuggestions = MOCK_ADDRESS_SUGGESTIONS.filter(suggestion =>
        suggestion.address.toLowerCase().includes(value.toLowerCase())
      );
      setLocationSuggestions(filteredSuggestions);
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
      setLocationSuggestions([]);
    }
  };

  const handleSelectSuggestion = (suggestion: { address: string; coords: [number, number] | null }) => {
    setLocation(suggestion.address);
    setDisplayCoordinates(suggestion.coords);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  const handleAddTag = () => {
    if (tagsInput.trim() && !tags.includes(tagsInput.trim())) {
      setTags([...tags, tagsInput.trim()]);
      setTagsInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!eventName.trim()) {
      newErrors.eventName = 'Event Name is required.';
    } else if (containsProfanity(eventName)) {
      newErrors.eventName = 'Event Name contains profanity.';
    }

    // Basic regex for address (e.g., "123 Main St, Anytown") or coordinates (e.g., "34.0522, -118.2437")
    const addressRegex = /\d+\s[A-Za-z]+\s[A-Za-z]+(?:.*)?/;
    const coordinatesRegex = /^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/;

    if (!location.trim()) {
      newErrors.location = 'Location is required.';
    } else if (!addressRegex.test(location) && !coordinatesRegex.test(location)) {
      newErrors.location = 'Please enter a valid address or coordinates (e.g., "123 Main St, Anytown" or "34.0522, -118.2437").';
    }
    if (!group.trim()) {
      newErrors.group = 'Group is required.';
    } else if (containsProfanity(group)) {
      newErrors.group = 'Group name contains profanity.';
    }

    if (!dateTime.trim()) {
      newErrors.dateTime = 'Date and Time is required.';
    }
    if (tags.length === 0) {
      newErrors.tags = 'At least one tag is required.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Process event data
    const eventData = {
      eventName,
      location,
      group,
      dateTime,
      tags,
      coordinates: displayCoordinates, // Use displayCoordinates for submission
    };
    console.log('Event Data:', eventData);
    // Here you would typically send this data to a backend or a global store.

    // Reset form
    setEventName('');
    setLocation('');
    setGroup('');
    setDateTime('');
    setTags([]);
    setErrors({});
    setDisplayCoordinates(null);
  };

  return (
    <div className="p-4 max-w-lg mx-auto text-foreground">
      <BackButton />
      <h1 className="text-2xl font-bold mb-6 text-center">Add New Event</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Event Name */}
        <div>
          <Label htmlFor="eventName">Event Name</Label>
          <Input
            id="eventName"
            type="text"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            className={errors.eventName ? 'border-destructive' : ''}
          />
          {errors.eventName && <p className="text-destructive text-sm mt-1">{errors.eventName}</p>}
        </div>

        {/* Location */}
        <div className="relative">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            type="text"
            value={location}
            onChange={handleLocationChange}
            onFocus={() => setShowSuggestions(locationSuggestions.length > 0)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 100)} // Hide suggestions after a short delay
            className={errors.location ? 'border-destructive' : ''}
            autoComplete="off"
          />
          {errors.location && <p className="text-destructive text-sm mt-1">{errors.location}</p>}
          {showSuggestions && locationSuggestions.length > 0 && (
            <ul className="absolute z-10 w-full bg-background border border-border rounded-md shadow-lg mt-1 max-h-60 overflow-auto">
              {locationSuggestions.map((suggestion, index) => (
                <li
                  key={index}
                  className="px-4 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
                  onMouseDown={() => handleSelectSuggestion(suggestion)} // Use onMouseDown to prevent onBlur from hiding suggestions
                >
                  {suggestion.address}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Group */}
        <div>
          <Label htmlFor="group">Group</Label>
          <Input
            id="group"
            type="text"
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            className={errors.group ? 'border-destructive' : ''}
          />
          {errors.group && <p className="text-destructive text-sm mt-1">{errors.group}</p>}
        </div>

        {/* Date and Time */}
        <div>
          <Label htmlFor="dateTime">Date and Time</Label>
          <Input
            id="dateTime"
            type="datetime-local"
            value={dateTime}
            onChange={(e) => setDateTime(e.target.value)}
            className={errors.dateTime ? 'border-destructive' : ''}
            max={maxDateTime}
          />
          {errors.dateTime && <p className="text-destructive text-sm mt-1">{errors.dateTime}</p>}
        </div>

        {/* Tags */}
        <div>
          <Label htmlFor="tagsInput">Tags</Label>
          <div className="flex space-x-2">
            <Input
              id="tagsInput"
              type="text"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault(); // Prevent form submission
                  handleAddTag();
                }
              }}
              placeholder="e.g., study, gaming"
              className={errors.tags ? 'border-destructive' : ''}
            />
            <Button type="button" onClick={handleAddTag} variant="secondary">Add Tag</Button>
          </div>
          {errors.tags && <p className="text-destructive text-sm mt-1">{errors.tags}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm">
                {tag}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => handleRemoveTag(tag)}
                  className="rounded-full h-5 w-5"
                >
                  &times;
                </Button>
              </span>
            ))}
          </div>
        </div>

        <Button type="submit" className="w-full">Create Event</Button>
      </form>

      {displayCoordinates && (
        <div className="mt-4 h-64 rounded-md overflow-hidden border border-border">
          <Map
            center={displayCoordinates}
            zoom={12}
            className="w-full h-full"
          >
            <MapMarker
              longitude={displayCoordinates[0]}
              latitude={displayCoordinates[1]}
            />
          </Map>
        </div>
      )}
    </div>
  );
}

