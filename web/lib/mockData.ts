export interface HourlyData {
  hour: string;
  percent: number;
  isLive: boolean;
}

export const MOCK_WEEKDAY_DATA: HourlyData[] = [
  { hour: "6am", percent: 20, isLive: false },
  { hour: "7am", percent: 35, isLive: false },
  { hour: "8am", percent: 55, isLive: false },
  { hour: "9am", percent: 75, isLive: false },
  { hour: "10am", percent: 85, isLive: false },
  { hour: "11am", percent: 90, isLive: false },
  { hour: "12pm", percent: 95, isLive: false },
  { hour: "1pm", percent: 90, isLive: false },
  { hour: "2pm", percent: 80, isLive: true },
  { hour: "3pm", percent: 85, isLive: false },
  { hour: "4pm", percent: 90, isLive: false },
  { hour: "5pm", percent: 100, isLive: false },
  { hour: "6pm", percent: 95, isLive: false },
  { hour: "7pm", percent: 70, isLive: false },
  { hour: "8pm", percent: 45, isLive: false },
  { hour: "9pm", percent: 25, isLive: false },
];

export const MOCK_WEEKEND_DATA: HourlyData[] = [
  { hour: "6am", percent: 15, isLive: false },
  { hour: "7am", percent: 30, isLive: false },
  { hour: "8am", percent: 60, isLive: false },
  { hour: "9am", percent: 85, isLive: false },
  { hour: "10am", percent: 100, isLive: false },
  { hour: "11am", percent: 95, isLive: false },
  { hour: "12pm", percent: 90, isLive: false },
  { hour: "1pm", percent: 85, isLive: false },
  { hour: "2pm", percent: 80, isLive: true },
  { hour: "3pm", percent: 75, isLive: false },
  { hour: "4pm", percent: 70, isLive: false },
  { hour: "5pm", percent: 65, isLive: false },
  { hour: "6pm", percent: 55, isLive: false },
  { hour: "7pm", percent: 40, isLive: false },
  { hour: "8pm", percent: 25, isLive: false },
  { hour: "9pm", percent: 15, isLive: false },
];
