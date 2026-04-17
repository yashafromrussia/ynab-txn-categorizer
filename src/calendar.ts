import { google, calendar_v3 } from 'googleapis';
import { addDays, parseISO, formatISO, subDays } from 'date-fns';

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: Date;
  end: Date;
}

export class CalendarClient {
  private calendar: calendar_v3.Calendar;
  private calendarId: string;

  constructor(calendarId: string, apiKey?: string) {
    this.calendarId = calendarId;

    if (apiKey) {
      this.calendar = google.calendar({ version: 'v3', auth: apiKey });
    } else {
      // Relies on GOOGLE_APPLICATION_CREDENTIALS environment variable
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
      });
      this.calendar = google.calendar({ version: 'v3', auth });
    }
  }

  async getEventsInRange(startDate: Date, endDate: Date): Promise<CalendarEvent[]> {
    try {
      const response = await this.calendar.events.list({
        calendarId: this.calendarId,
        timeMin: formatISO(startDate),
        timeMax: formatISO(endDate),
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items || [];

      return events.map(event => {
        const start = event.start?.dateTime || event.start?.date;
        const end = event.end?.dateTime || event.end?.date;
        
        return {
          id: event.id || '',
          summary: event.summary || '',
          description: event.description || undefined,
          start: start ? new Date(start) : new Date(),
          end: end ? new Date(end) : new Date(),
        };
      });
    } catch (error) {
      console.error('Error fetching calendar events:', error);
      return [];
    }
  }

  /**
   * Gets events around a specific date string (YYYY-MM-DD).
   * @param dateStr The date string from the transaction
   * @param daysWindow How many days before and after to check (default: 1)
   */
  async getEventsAroundDate(dateStr: string, daysWindow: number = 1): Promise<CalendarEvent[]> {
    const targetDate = parseISO(dateStr);
    const startDate = subDays(targetDate, daysWindow);
    const endDate = addDays(targetDate, daysWindow + 1); // +1 to ensure coverage
    
    return this.getEventsInRange(startDate, endDate);
  }
}
