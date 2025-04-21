// Mock for moment.js
export default function moment(date?: string) {
  return {
    format: (format: string) => {
      if (!date) return '';
      
      if (format === 'YYYY-MM-DD') {
        return '2023-01-15';
      }
      if (format === 'MMM D, YYYY') {
        return 'Jan 15, 2023';
      }
      return date;
    },
    isSame: (otherMoment: any, granularity: string) => {
      if (date === '2023-05-15T08:30:00Z' && granularity === 'day') {
        return true;
      }
      return false;
    }
  };
}

// Let moment() also work
moment.prototype = moment;