// Minimal typing for the browser (non-Capacitor) Web Speech Recognition API,
// which lacks official TS lib types. Only the members this app actually reads.
export interface WebSpeechRecognitionResult {
  0: { transcript: string };
  length: number;
}

export interface WebSpeechRecognitionResultList {
  0: WebSpeechRecognitionResult;
  length: number;
  [index: number]: WebSpeechRecognitionResult;
}

export interface WebSpeechRecognitionEvent {
  results: WebSpeechRecognitionResultList;
}

export interface WebSpeechRecognitionErrorEvent {
  error: string;
}

export interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: WebSpeechRecognitionEvent) => void) | null;
  onerror: ((event: WebSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

export type WebSpeechRecognitionCtor = new () => WebSpeechRecognition;

export function getWebSpeechRecognitionCtor(): WebSpeechRecognitionCtor | undefined {
  const win = window as unknown as {
    SpeechRecognition?: WebSpeechRecognitionCtor;
    webkitSpeechRecognition?: WebSpeechRecognitionCtor;
  };
  return win.SpeechRecognition || win.webkitSpeechRecognition;
}
