import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import BackButton from "@/components/routing/BackButton";
import { getMaxDateForEvent, containsProfanity } from '@/lib/utils';
import { Map, MapMarker } from '@/components/ui/map'; // Import Map and MapMarker
import { apiRequest, ApiError } from '@/lib/api';
import { useAuth0 } from '@auth0/auth0-react';

type AddressSuggestion = {
  address: string;
  coords: [number, number];
};

type LocationCoords = [number, number] | null;

type GroupMode = 'interest' | 'module';

type MeResponse = {
  data: {
    university?: string;
    course?: string;
    year?: number;
  };
};

type UniversityModule = {
  moduleId: string;
  name: string;
  year: number;
};

type UniversityCourse = {
  name: string;
  modules: UniversityModule[];
};

type University = {
  name: string;
  courses: UniversityCourse[];
};

export function AddView() {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const [eventName, setEventName] = useState('');
  const [location, setLocation] = useState('');
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [mode, setMode] = useState<GroupMode>('interest');
  const [moduleId, setModuleId] = useState('');
  const [moduleName, setModuleName] = useState('');
  const [moduleCourse, setModuleCourse] = useState('');
  const [catalog, setCatalog] = useState<University[]>([]);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [selectedModuleId, setSelectedModuleId] = useState('');
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [userYear, setUserYear] = useState<number | null>(null);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [locationSuggestions, setLocationSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [displayCoordinates, setDisplayCoordinates] = useState<LocationCoords>(null);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxDateTime = getMaxDateForEvent();

  const coordinatesRegex = /^-?\d{1,3}\.\d+,\s*-?\d{1,3}\.\d+$/;

  const getCoordinatesFromLocation = useCallback((value: string): LocationCoords => {
    // Try to parse as coordinates directly (MapLibreGL expects [lng, lat])
    const coordsMatch = value.match(/^(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)$/);
    if (coordsMatch) {
      const lat = parseFloat(coordsMatch[1]);
      const lng = parseFloat(coordsMatch[2]);
      if (!isNaN(lat) && !isNaN(lng)) {
        return [lng, lat];
      }
    }

    const matchedSuggestion = locationSuggestions.find(
      (suggestion) => suggestion.address.toLowerCase() === value.toLowerCase()
    );
    if (matchedSuggestion) {
      return matchedSuggestion.coords;
    }

    return null;
  }, [locationSuggestions]);

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocation(value);

    setSuggestError(null);

    const newCoords = getCoordinatesFromLocation(value);
    setDisplayCoordinates(newCoords);
  };

  useEffect(() => {
    if (location.trim().length < 3) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      return;
    }

    if (coordinatesRegex.test(location.trim())) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      setIsSuggesting(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSuggesting(true);
      try {
        const params = new URLSearchParams({
          q: location.trim(),
          format: 'jsonv2',
          addressdetails: '1',
          limit: '6',
          countrycodes: 'gb',
        });
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params.toString()}`,
          {
            headers: {
              'Accept-Language': 'en',
            },
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          throw new Error('Failed to fetch suggestions');
        }
        const results = (await response.json()) as Array<{
          display_name: string;
          lat: string;
          lon: string;
        }>;
        const suggestions = results
          .map((item) => ({
            address: item.display_name,
            coords: [parseFloat(item.lon), parseFloat(item.lat)] as [number, number],
          }))
          .filter((item) => !Number.isNaN(item.coords[0]) && !Number.isNaN(item.coords[1]));
        setLocationSuggestions(suggestions);
        setShowSuggestions(true);
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          return;
        }
        setSuggestError('Unable to load address suggestions.');
        setLocationSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setIsSuggesting(false);
      }
    }, 350);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [location]);

  const handleSelectSuggestion = (suggestion: AddressSuggestion) => {
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

  useEffect(() => {
    if (mode !== 'module') {
      setCatalog([]);
      setCatalogError(null);
      setIsCatalogLoading(false);
      return;
    }

    if (!isAuthenticated) {
      setCatalog([]);
      setCatalogError('Sign in to load module options.');
      setIsCatalogLoading(false);
      return;
    }

    let isActive = true;
    const loadCatalog = async () => {
      setIsCatalogLoading(true);
      setCatalogError(null);
      try {
        const me = await apiRequest<MeResponse>(
          '/me',
          { method: 'GET' },
          () =>
            getAccessTokenSilently({
              authorizationParams: {
                audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              },
            })
        );

        const response = await apiRequest<{ data: University[] }>(
          '/universities',
          { method: 'GET' },
          () =>
            getAccessTokenSilently({
              authorizationParams: {
                audience: import.meta.env.VITE_AUTH0_AUDIENCE,
              },
            })
        );

        if (!isActive) return;

        const universityName = me.data?.university?.trim();
        const year = typeof me.data?.year === 'number' ? me.data.year : null;
        setUserYear(year);
        if (!universityName) {
          setCatalog([]);
          setCatalogError('Set your university in your profile to pick a module.');
          return;
        }

        if (!year || year < 1) {
          setCatalog([]);
          setCatalogError('Set your year of study in your profile to pick a module.');
          return;
        }

        const university = (response.data ?? []).find(
          (entry) => entry.name === universityName
        );
        if (!university) {
          setCatalog([]);
          setCatalogError('No module catalog found for your university.');
          return;
        }

        setCatalog([university]);
        const defaultCourse =
          (me.data?.course && university.courses.find((course) => course.name === me.data.course))
            ?.name ??
          university.courses[0]?.name ??
          '';

        setSelectedCourse(defaultCourse);
      } catch (err) {
        if (!isActive) return;
        setCatalog([]);
        if (err instanceof ApiError) {
          setCatalogError(`Unable to load modules. (${err.status})`);
        } else {
          setCatalogError('Unable to load modules.');
        }
      } finally {
        if (isActive) {
          setIsCatalogLoading(false);
        }
      }
    };

    void loadCatalog();

    return () => {
      isActive = false;
    };
  }, [getAccessTokenSilently, isAuthenticated, mode]);

  const availableCourses = catalog[0]?.courses ?? [];
  const activeCourse = availableCourses.find((course) => course.name === selectedCourse);
  const availableModules = (activeCourse?.modules ?? []).filter(
    (module) => (userYear ? module.year === userYear : true)
  );

  useEffect(() => {
    if (mode !== 'module') return;

    if (!selectedCourse && availableCourses.length > 0) {
      setSelectedCourse(availableCourses[0].name);
      return;
    }

    if (availableModules.length === 0) {
      setSelectedModuleId('');
      setModuleId('');
      setModuleName('');
      setModuleCourse('');
      return;
    }

    if (!selectedModuleId || !availableModules.some((module) => module.moduleId === selectedModuleId)) {
      const fallback = availableModules[0];
      setSelectedModuleId(fallback.moduleId);
    }
  }, [availableCourses, availableModules, mode, selectedCourse, selectedModuleId]);

  useEffect(() => {
    if (mode !== 'module') return;

    const module = availableModules.find((entry) => entry.moduleId === selectedModuleId);
    if (!module) {
      setModuleId('');
      setModuleName('');
      setModuleCourse('');
      return;
    }

    setModuleId(module.moduleId);
    setModuleName(module.name);
    setModuleCourse(activeCourse?.name ?? '');
  }, [activeCourse, availableModules, mode, selectedModuleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    if (!eventName.trim()) {
      newErrors.eventName = 'Event Name is required.';
    } else if (containsProfanity(eventName)) {
      newErrors.eventName = 'Event Name contains profanity.';
    }

    if (!location.trim()) {
      newErrors.location = 'Location is required.';
    } else if (!coordinatesRegex.test(location) && !displayCoordinates) {
      newErrors.location = 'Pick a location from suggestions or enter coordinates (e.g., "54.7768, -1.5757").';
    }

    if (!startDateTime.trim()) {
      newErrors.startDateTime = 'Start date and time is required.';
    }
    if (!endDateTime.trim()) {
      newErrors.endDateTime = 'End date and time is required.';
    }
    if (startDateTime && endDateTime && new Date(endDateTime) <= new Date(startDateTime)) {
      newErrors.endDateTime = 'End time must be after the start time.';
    }

    if (mode === 'interest') {
      if (tags.length === 0) {
        newErrors.tags = 'At least one interest is required.';
      }
    } else {
      if (!selectedCourse) {
        newErrors.moduleCourse = 'Course is required.';
      }
      if (!selectedModuleId) {
        newErrors.moduleId = 'Module is required.';
      } else {
        const selectedModule = activeCourse?.modules.find(
          (module) => module.moduleId === selectedModuleId
        );
        if (!selectedModule) {
          newErrors.moduleId = 'Selected module is not available for this course.';
        } else if (userYear && selectedModule.year !== userYear) {
          newErrors.moduleId = 'Selected module is not in your current year.';
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const coords = displayCoordinates ?? getCoordinatesFromLocation(location.trim());
    if (!coords) {
      setErrors({ ...newErrors, location: 'Pick a location from suggestions or enter coordinates.' });
      return;
    }

    if (!isAuthenticated) {
      setSubmitError('You must be logged in to create a group.');
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const payload = {
        name: eventName.trim(),
        startAt: new Date(startDateTime).toISOString(),
        endAt: new Date(endDateTime).toISOString(),
        location: { lat: coords[1], lng: coords[0] },
        ...(mode === 'interest'
          ? { interest: tags[0] }
          : {
            module: {
              moduleId: moduleId.trim(),
              name: moduleName.trim(),
              course: moduleCourse.trim(),
            },
          }),
      };

      const response = await apiRequest<{ data: { _id: string } }>(
        '/groups',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        },
        () =>
          getAccessTokenSilently({
            authorizationParams: {
              audience: import.meta.env.VITE_AUTH0_AUDIENCE,
            },
          })
      );

      if (response?.data?._id) {
        navigate(`/groups/${response.data._id}/members`);
        return;
      }

      setEventName('');
      setLocation('');
      setStartDateTime('');
      setEndDateTime('');
      setTagsInput('');
      setTags([]);
      setModuleId('');
      setModuleName('');
      setModuleCourse('');
      setSelectedCourse('');
      setSelectedModuleId('');
      setErrors({});
      setDisplayCoordinates(null);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(`Failed to create group. (${err.status})`);
      } else {
        setSubmitError('Failed to create group.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 max-w-lg mx-auto text-foreground">
      <BackButton />
      <h1 className="text-2xl font-bold mb-6 text-center">Create group</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Group Name */}
        <div>
          <Label htmlFor="eventName">Group name</Label>
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
          {suggestError && (
            <p className="text-destructive text-sm mt-1">{suggestError}</p>
          )}
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
          {isSuggesting && (
            <p className="text-muted-foreground text-xs mt-1">Searching UK addresses...</p>
          )}
        </div>

        {/* Date and Time */}
        <div>
          <Label htmlFor="startDateTime">Start date and time</Label>
          <Input
            id="startDateTime"
            type="datetime-local"
            value={startDateTime}
            onChange={(e) => setStartDateTime(e.target.value)}
            className={errors.startDateTime ? 'border-destructive' : ''}
            max={maxDateTime}
          />
          {errors.startDateTime && (
            <p className="text-destructive text-sm mt-1">{errors.startDateTime}</p>
          )}
        </div>

        <div>
          <Label htmlFor="endDateTime">End date and time</Label>
          <Input
            id="endDateTime"
            type="datetime-local"
            value={endDateTime}
            onChange={(e) => setEndDateTime(e.target.value)}
            className={errors.endDateTime ? 'border-destructive' : ''}
            max={maxDateTime}
          />
          {errors.endDateTime && (
            <p className="text-destructive text-sm mt-1">{errors.endDateTime}</p>
          )}
        </div>

        <div>
          <Label htmlFor="groupMode">Group type</Label>
          <select
            id="groupMode"
            value={mode}
            onChange={(e) => setMode(e.target.value as GroupMode)}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option value="interest">Interest-based</option>
            <option value="module">Module-based</option>
          </select>
        </div>

        {/* Tags */}
        <div>
          {mode === 'interest' ? (
            <>
              <Label htmlFor="tagsInput">Interests</Label>
              <div className="flex space-x-2">
                <Input
                  id="tagsInput"
                  type="text"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag();
                    }
                  }}
                  placeholder="e.g., study, gaming"
                  className={errors.tags ? 'border-destructive' : ''}
                />
                <Button type="button" onClick={handleAddTag} variant="secondary">Add</Button>
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
            </>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="moduleCourse">Course</Label>
                <select
                  id="moduleCourse"
                  value={selectedCourse}
                  onChange={(e) => setSelectedCourse(e.target.value)}
                  className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${errors.moduleCourse ? 'border-destructive' : ''}`}
                  disabled={isCatalogLoading || availableCourses.length === 0}
                >
                  <option value="" disabled>
                    {isCatalogLoading ? 'Loading courses...' : 'Select a course'}
                  </option>
                  {availableCourses.map((course) => (
                    <option key={course.name} value={course.name}>
                      {course.name}
                    </option>
                  ))}
                </select>
                {errors.moduleCourse && (
                  <p className="text-destructive text-sm mt-1">{errors.moduleCourse}</p>
                )}
              </div>
              <div>
                <Label htmlFor="moduleSelect">Module</Label>
                <select
                  id="moduleSelect"
                  value={selectedModuleId}
                  onChange={(e) => setSelectedModuleId(e.target.value)}
                  className={`flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${errors.moduleId ? 'border-destructive' : ''}`}
                  disabled={isCatalogLoading || availableModules.length === 0}
                >
                  <option value="" disabled>
                    {isCatalogLoading ? 'Loading modules...' : 'Select a module'}
                  </option>
                  {availableModules.map((module) => (
                    <option key={module.moduleId} value={module.moduleId}>
                      {module.moduleId} - {module.name}
                    </option>
                  ))}
                </select>
                {errors.moduleId && (
                  <p className="text-destructive text-sm mt-1">{errors.moduleId}</p>
                )}
              </div>
              {catalogError && (
                <p className="text-destructive text-sm">{catalogError}</p>
              )}
            </div>
          )}
        </div>

        {submitError && <p className="text-destructive text-sm">{submitError}</p>}

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? 'Creating group...' : 'Create group'}
        </Button>
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

