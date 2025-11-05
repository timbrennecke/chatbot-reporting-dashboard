/**
 * Shared constants used across the application
 */

// Topic categorization keywords (German)
export const TOPIC_KEYWORDS = {
  'Parkplätze/Parking': ['parkplatz', 'parkplätze', 'parken', 'auto', 'fahrzeug', 'stellplatz', 'garage', 'tiefgarage', 'wo kann ich parken', 'parkgebühren', 'kostenpflichtig parken', 'parkschein', 'parkuhr'],
  'Frühstück/Breakfast': ['frühstück', 'morgenbuffet', 'buffet', 'morgen', 'kaffee', 'brötchen', 'gibt es frühstück', 'frühstückszeiten', 'kontinentales frühstück', 'müsli', 'marmelade', 'butter', 'eier', 'speck'],
  'Check-in/Öffnungszeiten': ['öffnungszeit', 'öffnungszeiten', 'geöffnet', 'öffnen', 'schließen', 'geschlossen', 'wann', 'uhrzeit', 'bis wann', 'ab wann', 'wie lange geöffnet', 'öffnungszeiten heute', 'wann macht auf', 'wann macht zu', 'check-in', 'check-out', 'checkin', 'checkout', 'anreise', 'abreise', 'einchecken', 'auschecken', 'eingecheckt', 'ankunft', 'schlüssel', 'zimmerschlüssel', 'keycard', 'rezeption', 'empfang', 'wann kann ich einchecken'],
  'Preise/Prices': ['preis', 'preise', 'kosten', 'wie viel', 'was kostet', 'teuer', 'günstig', 'euro', 'geld', 'wie teuer', 'preiswert', 'bezahlen', 'zahlung', 'gebühr', 'tarif'],
  'Reservierung/Booking': ['reservierung', 'buchen', 'buchung', 'verfügbar', 'frei', 'belegt', 'termin', 'platz', 'reservieren', 'vorbestellen', 'tisch reservieren', 'platz buchen', 'halbpension', 'kulanzgutschein', 'kulanzguthaben', 'gutschein', 'wie kann ich nach kostenloser stornierung filtern'],
  'WLAN/WiFi': ['wlan', 'wifi', 'wi-fi', 'internet', 'netzwerk', 'verbindung', 'online', 'zugang', 'internetverbindung', 'wlan passwort', 'wifi passwort', 'wie komme ich ins internet', 'netz', 'empfang'],
  'Restaurant/Essen': ['restaurant', 'essen', 'abendessen', 'mittagessen', 'küche', 'speisekarte', 'bestellen', 'trinken', 'bar', 'café', 'kaffee', 'gastronomie', 'verpflegung', 'mahlzeit', 'getränke', 'alkohol', 'bier', 'wein'],
  'Transport/Anfahrt': ['anfahrt', 'transport', 'bus', 'bahn', 'zug', 'taxi', 'weg', 'fahren', 'gehen', 'entfernung', 'wie komme ich', 'flughafen', 'bahnhof', 'öffentliche verkehrsmittel', 'u-bahn', 's-bahn', 'straßenbahn', 'bushaltestelle', 'fahrplan', 'verbindung'],
  'Stornierung/Cancellation': ['stornierung', 'stornieren', 'absagen', 'rückgängig', 'zurück', 'ändern', 'umbuchen', 'stornogebühr', 'kostenlos stornieren', 'buchung ändern', 'termin verschieben'],
  'Zimmer/Room': ['zimmer', 'bett', 'schlafzimmer', 'bad', 'dusche', 'balkon', 'aussicht', 'etage', 'doppelzimmer', 'einzelzimmer', 'familienzimmer', 'klimaanlage', 'heizung', 'fernseher', 'minibar', 'safe', 'handtücher'],
  'Wellness/Spa': ['wellness', 'spa', 'sauna', 'pool', 'schwimmbad', 'massage', 'entspannung', 'fitness', 'sport', 'schwimmen', 'baden', 'wellnessbereich', 'fitnessraum', 'dampfbad', 'whirlpool', 'jacuzzi', 'kosmetik'],
  'Events/Veranstaltungen': ['veranstaltung', 'feier', 'hochzeit', 'tagung', 'seminar', 'workshop', 'fest', 'festival', 'konferenz', 'geschäftlich', 'firmenfeier', 'geburtstag', 'jubiläum'],
  'Fahrrad/Bicycle': ['fahrrad', 'rad', 'fahrräder', 'abstellen', 'parken', 'garage', 'fahrradgarage', 'fahrradkeller', 'fahrradständer', 'radfahren', 'mountainbike', 'e-bike', 'pedelec', 'fahrradverleih', 'fahrradtour', 'radweg'],
  'Inspiration/Reiseberatung': ['urlaub', 'reise', 'hotel', 'ziel', 'wohin', 'zeig mir', 'schöner urlaub', 'reiseberatung', 'reiseziel', 'urlaubsziel', 'ausflug', 'sehenswürdigkeiten', 'gibt es wälder', 'natur', 'landschaft', 'berge', 'seen', 'wandern', 'spazieren', 'umgebung', 'nähe', 'in der nähe', 'was gibt es hier zu sehen', 'lohnenswert', 'schön', 'empfehlung', 'empfehlungen', 'vorschlag', 'tipp', 'tipps', 'was können sie empfehlen', 'beste', 'gut', 'aktivitäten', 'was kann man machen', 'was gibt es hier', 'lohnt sich', 'interessant', 'besichtigen'],
  'Kundenberatung/Customer Support': ['hilfe', 'kundenservice', 'beratung', 'beraten', 'rückruf', 'zurückrufen', 'anrufen', 'ruf mich an', 'nachricht', 'kontakt', 'sprechen', 'problem', 'beschwerde', 'frage', 'können sie mir helfen', 'ich brauche hilfe', 'unterstützung', 'mitarbeiter', 'personal', 'ich hätte gerne', 'könnten sie', 'wäre es möglich'],
  'Haustiere/Pets': ['haustiere', 'haustier', 'hund', 'hunde', 'katze', 'katzen', 'tier', 'tiere', 'mit hund', 'mit katze', 'erlaubt', 'mitbringen', 'tierfrei', 'hundefrei', 'katzenfrei']
};

// Exact message patterns for Inspiration/Reiseberatung category
export const INSPIRATION_EXACT_MESSAGES = [
  'Beliebte Ziele für einen Wellnesstrip',
  'Welche Städte sind bekannt für ihr lebendiges Nachtleben?',
  'Reiseziele für einen Städtetrip',
  'Kinderfreundliche All-Inclusive-Resorts',
  'Rückzugsorte in den Bergen',
  'Reiseziele für Outdoor-Aktivitäten'
];

// Pattern-based messages for Inspiration/Reiseberatung (X = variable placeholder)
export const INSPIRATION_PATTERN_MESSAGES = [
  /^Welche gut bewerteten Hotels in .+ kannst du mir empfehlen\?$/i,
  /^Welche Hotels in .+ haben einen Parkplatz\?$/i,
  /^Welche Veranstaltungen gibt es in .+ während meiner Reise\?$/i,
  /^Wie ist das Klima in .+ während meiner Reise\?$/i,
  /^Welche Hotels in .+ haben gut bewertetes Frühstück\?$/i
];

// Category colors for tags
export const CATEGORY_COLORS: { [key: string]: { bg: string; text: string; border: string } } = {
  'Parkplätze/Parking': { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  'Frühstück/Breakfast': { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  'Öffnungszeiten/Opening Hours': { bg: '#e0e7ff', text: '#3730a3', border: '#6366f1' },
  'Preise/Prices': { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  'Reservierung/Booking': { bg: '#fce7f3', text: '#be185d', border: '#ec4899' },
  'WLAN/WiFi': { bg: '#e0f2fe', text: '#0c4a6e', border: '#0ea5e9' },
  'Check-in/Check-out': { bg: '#f3e8ff', text: '#6b21a8', border: '#a855f7' },
  'Check-in/Öffnungszeiten': { bg: '#f3e8ff', text: '#6b21a8', border: '#a855f7' },
  'Restaurant/Essen': { bg: '#fed7d7', text: '#c53030', border: '#f56565' },
  'Transport/Anfahrt': { bg: '#e6fffa', text: '#234e52', border: '#38b2ac' },
  'Stornierung/Cancellation': { bg: '#fef5e7', text: '#c05621', border: '#ed8936' },
  'Zimmer/Room': { bg: '#edf2f7', text: '#2d3748', border: '#4a5568' },
  'Wellness/Spa': { bg: '#f0fff4', text: '#22543d', border: '#48bb78' },
  'Events/Veranstaltungen': { bg: '#faf5ff', text: '#553c9a', border: '#9f7aea' },
  'Haustiere/Pets': { bg: '#fffbeb', text: '#92400e', border: '#f6ad55' },
  'Fahrrad/Bicycle': { bg: '#f0f9ff', text: '#0c4a6e', border: '#0284c7' },
  'Inspiration/Reiseberatung': { bg: '#ecfdf5', text: '#065f46', border: '#10b981' },
  'Kundenberatung/Customer Support': { bg: '#fef2f2', text: '#991b1b', border: '#ef4444' },
  'Others/Sonstiges': { bg: '#f9fafb', text: '#374151', border: '#6b7280' }
};

