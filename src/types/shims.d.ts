declare module '@ionic/react' {
  export const IonContent: any;
  export const IonPage: any;
  export const IonHeader: any;
  export const IonToolbar: any;
  export const IonTitle: any;
  export const IonList: any;
  export const IonItem: any;
  export const IonLabel: any;
  export const IonSpinner: any;
  export const IonAlert: any;
  export const IonInfiniteScroll: any;
  export const IonInfiniteScrollContent: any;
  const _default: any;
  export default _default;
}

declare module 'capacitor-calendar' {
  export function createEvent(event: any): Promise<any>;
  export function openCalendar(opts: any): Promise<any>;
  export function deleteEvent(id: string): Promise<any>;
  const CapacitorCalendar: any;
  export default CapacitorCalendar;
}
declare module 'capacitor-calendar/dist/esm';
declare module 'capacitor-calendar/dist/esm/definitions';

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}

export {};
